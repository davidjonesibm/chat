import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { WebSocket } from 'ws';
import { handleWebSocketConnection } from '../handlers/chat.js';

export default fp(
  async (fastify: FastifyInstance) => {
    // Register @fastify/websocket plugin
    await fastify.register(websocket, {
      options: {
        maxPayload: 64 * 1024, // 64 KB
      },
    });

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
            const { data: { user }, error } = await fastify.supabaseAdmin.auth.getUser(token);
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

        handleWebSocketConnection(socket, request.user, fastify.supabaseAdmin);
      },
    );

    fastify.log.info('WebSocket handlers registered at /ws');
  },
  { name: 'socket-plugin', dependencies: ['supabase-plugin'] },
);
