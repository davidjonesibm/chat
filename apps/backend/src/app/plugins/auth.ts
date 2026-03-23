import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import PocketBase from 'pocketbase';
import type { User, JwtClaims } from '@chat/shared';
import { decodeJwt } from '../utils/jwt';

/**
 * Auth middleware plugin - verifies JWT tokens and attaches user context
 * Skips authentication for public auth routes
 */
export default fp(
  async function (fastify: FastifyInstance) {
    fastify.addHook(
      'preHandler',
      async (request: FastifyRequest, reply: FastifyReply) => {
        // Extract pathname without query string for route matching
        const pathname = request.url.split('?')[0];

        // Skip auth check for public routes
        if (
          pathname === '/api/auth/register' ||
          pathname === '/api/auth/login'
        ) {
          return;
        }

        // Skip auth check for health check
        if (pathname === '/health') {
          return;
        }

        // Check for Authorization header
        const authHeader = request.headers.authorization;
        if (!authHeader) {
          reply.code(401).send({
            error: 'Unauthorized',
            message: 'Missing Authorization header',
          });
          return;
        }

        // Extract token from Bearer schema
        const token = authHeader.replace('Bearer ', '');
        if (!token) {
          reply.code(401).send({
            error: 'Unauthorized',
            message: 'Invalid Authorization header format',
          });
          return;
        }

        try {
          // Decode token to get claims
          const claims = decodeJwt(token);
          if (!claims) {
            reply
              .code(401)
              .send({ error: 'Unauthorized', message: 'Invalid token format' });
            return;
          }

          // Check token expiration
          if (claims.exp && claims.exp * 1000 < Date.now()) {
            reply
              .code(401)
              .send({ error: 'Unauthorized', message: 'Token expired' });
            return;
          }

          // Create a fresh PocketBase instance (don't mutate shared state)
          const freshPb = new PocketBase(
            process.env.POCKETBASE_URL || 'http://localhost:8090',
          );
          freshPb.authStore.save(token, null);
          const record = await freshPb.collection('users').getOne(claims.id);

          const user: User = {
            id: record.id,
            email: record['email'] as string,
            username: record['username'] as string,
            avatar: record['avatar'] as string | undefined,
            createdAt: record.created,
            updated: record.updated,
          };

          // Attach user and claims to request for later use
          request.user = user;
          request.claims = claims;
        } catch (err) {
          fastify.log.error({ err }, 'Token verification error');
          reply
            .code(401)
            .send({ error: 'Unauthorized', message: 'Invalid token' });
        }
      },
    );
  },
  {
    name: 'auth-plugin',
    dependencies: ['pocketbase-plugin'],
  },
);

// TypeScript module augmentation to add user context to requests
declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
    claims?: JwtClaims;
  }
}
