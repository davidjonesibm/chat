import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { User } from '@chat/shared';

/**
 * Reusable authentication function
 * Verifies JWT tokens using Supabase's auth.getUser() and attaches user context to request
 * Use as preHandler in route options: { preHandler: [authenticate] }
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Check for Authorization header
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    throw reply.unauthorized('Missing Authorization header');
  }

  // Extract token from Bearer schema
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    throw reply.unauthorized('Invalid Authorization header format');
  }

  // Verify token using Supabase's built-in verification
  const { data: { user }, error } = await request.server.supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    throw reply.unauthorized('Invalid or expired token');
  }

  // Build user object from Supabase user data
  const userObj: User = {
    id: user.id,
    email: user.email || '',
    username: (user.user_metadata?.username as string) || (user.user_metadata?.name as string) || user.email?.split('@')[0] || '',
    avatar: (user.user_metadata?.avatar as string) || '',
    created_at: user.created_at,
    updated_at: user.updated_at || user.created_at,
  };

  request.user = userObj;
}

/**
 * Auth plugin - decorates Fastify instance with authenticate function
 * Does NOT apply global authentication - routes must opt-in via preHandler
 */
export default fp(
  async function (fastify: FastifyInstance) {
    // Decorate instance with authenticate function for convenience
    fastify.decorate('authenticate', authenticate);

    fastify.log.info('Auth plugin registered (opt-in authentication)');
  },
  {
    name: 'auth-plugin',
    dependencies: ['supabase-plugin', '@fastify/sensible'],
  },
);

// TypeScript module augmentation
declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }

  interface FastifyInstance {
    authenticate: typeof authenticate;
  }
}
