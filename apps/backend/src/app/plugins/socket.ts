import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { WebSocket } from 'ws';
import type { PushSender } from '../handlers/chat.js';
import { handleWebSocketConnection } from '../handlers/chat.js';
import type { PushNotificationPayload } from '@chat/shared';

export default fp(
  async (fastify: FastifyInstance) => {
    // Register @fastify/websocket plugin
    await fastify.register(websocket, {
      options: {
        maxPayload: 64 * 1024, // 64 KB
      },
    });

    // Create push sender function
    const sendPushToUser: PushSender = async (
      userId: string,
      payload: PushNotificationPayload,
    ) => {
      try {
        // Check if push is configured
        if (!fastify.vapidConfigured) {
          fastify.log.debug('Push not configured, skipping notification');
          return;
        }

        // Fetch all push subscriptions for this user
        // NOTE: push_subscriptions types not yet generated - using type assertion
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: subscriptions, error } = await (
          fastify.supabaseAdmin as any
        )
          .from('push_subscriptions')
          .select('id, endpoint, keys_p256dh, keys_auth')
          .eq('user_id', userId);

        if (error) {
          fastify.log.error(
            { err: error, userId },
            'Failed to fetch push subscriptions',
          );
          return;
        }

        if (!subscriptions || subscriptions.length === 0) {
          fastify.log.debug({ userId }, 'No push subscriptions found for user');
          return;
        }

        // Send to each subscription
        const sendPromises = subscriptions.map(async (sub) => {
          try {
            const pushSubscription = {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys_p256dh,
                auth: sub.keys_auth,
              },
            };

            await fastify.webpush.sendNotification(
              pushSubscription,
              JSON.stringify(payload),
            );

            fastify.log.debug(
              { userId, endpoint: sub.endpoint },
              'Push notification sent',
            );
          } catch (err: any) {
            // Handle expired/invalid subscriptions (HTTP 410 Gone)
            if (err?.statusCode === 410) {
              fastify.log.info(
                { userId, endpoint: sub.endpoint },
                'Removing expired push subscription',
              );

              // Delete the expired subscription
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (fastify.supabaseAdmin as any)
                  .from('push_subscriptions')
                  .delete()
                  .eq('id', sub.id);
              } catch (deleteErr) {
                fastify.log.error(
                  { err: deleteErr, subscriptionId: sub.id },
                  'Failed to delete expired subscription',
                );
              }
            } else {
              fastify.log.error(
                {
                  userId,
                  endpoint: sub.endpoint,
                  statusCode: err?.statusCode,
                  errorBody: err?.body,
                  errorMessage: err?.message,
                },
                'Failed to send push notification',
              );
              throw err;
            }
          }
        });

        await Promise.all(sendPromises);
      } catch (err) {
        fastify.log.error({ err, userId }, 'Error in sendPushToUser');
        throw err;
      }
    };

    // Create WebSocket route with authentication
    fastify.get(
      '/ws',
      {
        websocket: true,
        preValidation: async (request: FastifyRequest, reply: FastifyReply) => {
          try {
            const token = (request.query as Record<string, unknown>)?.['token'];
            if (!token || typeof token !== 'string') {
              reply.code(401).send({ error: 'Authentication required' });
              return;
            }

            // Verify token using Supabase's built-in verification
            const {
              data: { user },
              error,
            } = await fastify.supabaseAdmin.auth.getUser(token);
            if (error || !user) {
              reply.code(401).send({ error: 'Invalid or expired token' });
              return;
            }

            // Build user object from Supabase user data
            request.user = {
              id: user.id,
              email: user.email || '',
              username:
                (user.user_metadata?.username as string) ||
                (user.user_metadata?.name as string) ||
                user.email?.split('@')[0] ||
                '',
              avatar: (user.user_metadata?.avatar as string) || '',
              created_at: user.created_at,
              updated_at: user.updated_at || user.created_at,
            };
          } catch (err) {
            fastify.log.error({ err }, 'WebSocket authentication error');
            reply.code(401).send({ error: 'Authentication failed' });
          }
        },
      },
      (socket: WebSocket, request: FastifyRequest) => {
        if (!request.user) {
          socket.close(1008, 'Authentication failed');
          return;
        }

        handleWebSocketConnection(
          socket,
          request.user,
          fastify.supabaseAdmin,
          sendPushToUser,
        );
      },
    );

    fastify.log.info('WebSocket handlers registered at /ws');
  },
  { name: 'socket-plugin', dependencies: ['supabase-plugin', 'push-plugin'] },
);
