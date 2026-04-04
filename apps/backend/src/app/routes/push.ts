import { FastifyInstance, FastifyRequest } from 'fastify';
import type {
  PushSubscribeRequest,
  PushSubscribeResponse,
  PushUnsubscribeRequest,
  PushUnsubscribeResponse,
  VapidPublicKeyResponse,
} from '@chat/shared';

function requireUser(request: FastifyRequest) {
  if (!request.user)
    throw new Error('Unauthenticated request reached route handler');
  return request.user;
}

/**
 * Push notification routes
 * - GET /vapid-public-key - Get VAPID public key (public)
 * - POST /subscribe - Subscribe to push notifications (protected)
 * - DELETE /unsubscribe - Unsubscribe from push notifications (protected)
 */
export default async function (fastify: FastifyInstance) {
  /**
   * GET /api/push/vapid-public-key
   * Returns the VAPID public key for push subscription
   * Public endpoint - no authentication required
   */
  fastify.get<{ Reply: VapidPublicKeyResponse }>(
    '/vapid-public-key',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              publicKey: { type: 'string' },
            },
            required: ['publicKey'],
          },
          503: { $ref: 'error#' },
        },
      },
    },
    async () => {
      if (!fastify.vapidConfigured) {
        throw fastify.httpErrors.serviceUnavailable(
          'Push notifications are not configured on this server',
        );
      }

      const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
      if (!publicKey) {
        throw fastify.httpErrors.serviceUnavailable(
          'VAPID public key not available',
        );
      }

      return { publicKey };
    },
  );

  /**
   * POST /api/push/subscribe
   * Save a push subscription for the authenticated user
   */
  fastify.post<{ Body: PushSubscribeRequest; Reply: PushSubscribeResponse }>(
    '/subscribe',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          properties: {
            subscription: {
              type: 'object',
              properties: {
                endpoint: { type: 'string' },
                keys: {
                  type: 'object',
                  properties: {
                    p256dh: { type: 'string' },
                    auth: { type: 'string' },
                  },
                  required: ['p256dh', 'auth'],
                },
              },
              required: ['endpoint', 'keys'],
            },
          },
          required: ['subscription'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
          400: { $ref: 'error#' },
          401: { $ref: 'error#' },
          503: { $ref: 'error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Body: PushSubscribeRequest }>) => {
      if (!fastify.vapidConfigured) {
        throw fastify.httpErrors.serviceUnavailable(
          'Push notifications are not configured on this server',
        );
      }

      const userId = requireUser(request).id;
      const { subscription } = request.body;

      // Upsert push subscription
      const { error } = await fastify.supabaseAdmin
        .from('push_subscriptions')
        .upsert(
          {
            user_id: userId,
            endpoint: subscription.endpoint,
            keys_p256dh: subscription.keys.p256dh,
            keys_auth: subscription.keys.auth,
          },
          {
            onConflict: 'user_id,endpoint',
          },
        );

      if (error) {
        fastify.log.error(
          { error, userId, endpoint: subscription.endpoint },
          'Failed to save push subscription',
        );
        throw fastify.httpErrors.internalServerError(
          'Failed to save push subscription',
        );
      }

      fastify.log.info(
        { userId, endpoint: subscription.endpoint },
        'Push subscription saved',
      );

      return { success: true };
    },
  );

  /**
   * DELETE /api/push/unsubscribe
   * Remove a push subscription for the authenticated user
   */
  fastify.delete<{
    Body: PushUnsubscribeRequest;
    Reply: PushUnsubscribeResponse;
  }>(
    '/unsubscribe',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          properties: {
            endpoint: { type: 'string' },
          },
          required: ['endpoint'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
          401: { $ref: 'error#' },
          503: { $ref: 'error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Body: PushUnsubscribeRequest }>) => {
      if (!fastify.vapidConfigured) {
        throw fastify.httpErrors.serviceUnavailable(
          'Push notifications are not configured on this server',
        );
      }

      const userId = requireUser(request).id;
      const { endpoint } = request.body;

      // Delete push subscription
      const { error } = await fastify.supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint);

      if (error) {
        fastify.log.error(
          { error, userId, endpoint },
          'Failed to delete push subscription',
        );
        throw fastify.httpErrors.internalServerError(
          'Failed to delete push subscription',
        );
      }

      fastify.log.info({ userId, endpoint }, 'Push subscription removed');

      return { success: true };
    },
  );
}
