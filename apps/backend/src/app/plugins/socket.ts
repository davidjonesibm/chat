import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { WebSocket } from 'ws';
import PocketBase from 'pocketbase';
import { decodeJwt } from '../utils/jwt.js';
import { handleWebSocketConnection } from '../handlers/chat.js';

export default fp(
  async (fastify: FastifyInstance) => {
    // Register @fastify/websocket plugin
    await fastify.register(websocket, {
      options: {
        maxPayload: 64 * 1024, // 64 KB
      },
    });

    const pocketbaseUrl = process.env.POCKETBASE_URL || 'http://localhost:8090';

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

            const claims = decodeJwt(token);
            if (!claims) {
              reply.code(401).send({ error: 'Invalid token' });
              return;
            }

            if (claims.exp && claims.exp * 1000 < Date.now()) {
              reply.code(401).send({ error: 'Token expired' });
              return;
            }

            const pb = new PocketBase(pocketbaseUrl);
            pb.authStore.save(token, null);
            const user = await pb.collection('users').getOne(claims.id);

            request.user = {
              id: user.id,
              email: user['email'] as string,
              username: (user['username'] ||
                user['name'] ||
                user['email']) as string,
              avatar: (user['avatar'] as string) || undefined,
              createdAt: user.created,
              updated: user.updated,
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

        const token = (request.query as Record<string, string>)['token'];
        handleWebSocketConnection(socket, request.user, pocketbaseUrl, token);
      },
    );

    fastify.log.info('WebSocket handlers registered at /ws');
  },
  { name: 'socket-plugin' },
);
