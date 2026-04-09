import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { User } from '@chat/shared';
import { verifySupabaseJwt } from '../utils/jwt.js';

const jwtSecret = process.env.SUPABASE_JWT_SECRET ?? '';

/**
 * Build a User object from a Supabase auth user or a local JWT payload.
 */
function buildUserFromMetadata(
  id: string,
  email: string,
  userMetadata: Record<string, unknown>,
  createdAt: string,
  updatedAt: string,
): User {
  return {
    id,
    email,
    username:
      (userMetadata.username as string) ||
      (userMetadata.name as string) ||
      email.split('@')[0] ||
      '',
    avatar: (userMetadata.avatar as string) || '',
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

/**
 * Reusable authentication function
 * Verifies JWT tokens and attaches user context to request.
 * Uses local JWT verification when SUPABASE_JWT_SECRET is set,
 * otherwise falls back to Supabase's auth.getUser() remote call.
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

  if (jwtSecret) {
    // Local JWT verification — no network round-trip
    try {
      const payload = await verifySupabaseJwt(token, jwtSecret);
      const now = new Date().toISOString();
      request.user = buildUserFromMetadata(
        payload.id,
        payload.email,
        payload.user_metadata,
        now,
        now,
      );
    } catch {
      throw reply.unauthorized('Invalid or expired token');
    }
  } else {
    // Fallback: verify via Supabase remote call
    const {
      data: { user },
      error,
    } = await request.server.supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      throw reply.unauthorized('Invalid or expired token');
    }

    request.user = buildUserFromMetadata(
      user.id,
      user.email || '',
      (user.user_metadata as Record<string, unknown>) ?? {},
      user.created_at,
      user.updated_at || user.created_at,
    );
  }
}

/**
 * Auth plugin - decorates Fastify instance with authenticate function
 * Does NOT apply global authentication - routes must opt-in via preHandler
 */
export default fp(
  async function (fastify: FastifyInstance) {
    // Decorate instance with authenticate function for convenience
    fastify.decorate('authenticate', authenticate);

    if (jwtSecret) {
      fastify.log.info('Auth plugin registered — using local JWT verification');
    } else {
      fastify.log.info(
        'Auth plugin registered — using Supabase remote verification (set SUPABASE_JWT_SECRET for local verification)',
      );
    }
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
