import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { User } from '@chat/shared';
import { verifySupabaseJwt } from '../utils/jwt.js';

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
 * Uses JWKS-based JWT verification as the primary path,
 * falling back to Supabase's auth.getUser() remote call on failure.
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

  // Primary path: JWKS-based JWT verification (no network round-trip to auth service)
  try {
    const payload = await verifySupabaseJwt(token);
    const now = new Date().toISOString();
    request.user = buildUserFromMetadata(
      payload.id,
      payload.email,
      payload.user_metadata,
      now,
      now,
    );
    return;
  } catch {
    request.log.debug(
      'JWKS verification failed, falling back to Supabase remote verification',
    );
  }

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

/**
 * Auth plugin - decorates Fastify instance with authenticate function
 * Does NOT apply global authentication - routes must opt-in via preHandler
 */
export default fp(
  async function (fastify: FastifyInstance) {
    // Decorate instance with authenticate function for convenience
    fastify.decorate('authenticate', authenticate);

    fastify.log.info(
      'Auth plugin registered — using JWKS verification with Supabase remote fallback',
    );
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
