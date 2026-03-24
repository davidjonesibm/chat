import { FastifyInstance, FastifyRequest } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import type { RegisterRequest, LoginRequest } from '@chat/shared';

function requireUser(request: FastifyRequest) {
  if (!request.user)
    throw new Error('Unauthenticated request reached route handler');
  return request.user;
}

// Create anon-key client for session creation
let supabaseAnonInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseAnon() {
  if (!supabaseAnonInstance) {
    const anonKey = process.env.SUPABASE_PUBLISHABLE;
    if (!anonKey) throw new Error('SUPABASE_PUBLISHABLE is required');
    supabaseAnonInstance = createClient(
      process.env.SUPABASE_URL || 'http://localhost:54321',
      anonKey,
      { auth: { persistSession: false } },
    );
  }
  return supabaseAnonInstance;
}

/**
 * Authentication routes
 * - POST /register - Create new user
 * - POST /login - Authenticate user
 * - GET /me - Get current user profile (protected)
 */
export default async function (fastify: FastifyInstance) {
  /**
   * POST /api/auth/register
   * Register a new user with email and password
   */
  fastify.post<{ Body: RegisterRequest }>(
    '/register',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            username: { type: 'string', minLength: 1 },
          },
          required: ['email', 'password', 'username'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              user: { $ref: 'user#' },
              token: { type: 'string' },
            },
          },
          400: { $ref: 'error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Body: RegisterRequest }>, reply) => {
      const { email, password, username } = request.body;

      // Create user with admin client
      const { data: userData, error: createError } =
        await fastify.supabaseAdmin.auth.admin.createUser({
          email: email.toLowerCase(),
          password,
          email_confirm: true,
          user_metadata: {
            username: username.trim(),
            name: username.trim(),
          },
        });

      if (createError) {
        fastify.log.error({ error: createError }, 'User creation failed');
        throw fastify.httpErrors.badRequest(
          createError.message || 'User creation failed',
        );
      }

      // Sign in to get session token
      const supabaseAnon = getSupabaseAnon();
      const { data: signInData, error: signInError } =
        await supabaseAnon.auth.signInWithPassword({
          email: email.toLowerCase(),
          password,
        });

      if (signInError || !signInData.session) {
        fastify.log.error(
          { error: signInError },
          'Sign in failed after registration',
        );
        throw fastify.httpErrors.internalServerError('Sign in failed');
      }

      reply.code(201);
      return {
        user: {
          id: userData.user.id,
          email: userData.user.email || '',
          username:
            (userData.user.user_metadata?.username as string) ||
            username.trim(),
          avatar: '',
          created_at: userData.user.created_at,
          updated_at: userData.user.updated_at || userData.user.created_at,
        },
        token: signInData.session.access_token,
      };
    },
  );

  /**
   * POST /api/auth/login
   * Authenticate user with email and password
   */
  fastify.post<{ Body: LoginRequest }>(
    '/login',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
          },
          required: ['email', 'password'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              user: { $ref: 'user#' },
              token: { type: 'string' },
            },
          },
          401: { $ref: 'error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Body: LoginRequest }>, reply) => {
      const { email, password } = request.body;

      // Authenticate with Supabase
      const supabaseAnon = getSupabaseAnon();
      const { data, error } = await supabaseAnon.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (error || !data.session || !data.user) {
        throw reply.unauthorized('Invalid email or password');
      }

      return {
        user: {
          id: data.user.id,
          email: data.user.email || '',
          username:
            (data.user.user_metadata?.username as string) ||
            data.user.email?.split('@')[0] ||
            '',
          avatar: (data.user.user_metadata?.avatar as string) || '',
          created_at: data.user.created_at,
          updated_at: data.user.updated_at || data.user.created_at,
        },
        token: data.session.access_token,
      };
    },
  );

  /**
   * GET /api/auth/me
   * Get current authenticated user profile (protected route)
   */
  fastify.get(
    '/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: { $ref: 'user#' },
          401: { $ref: 'error#' },
        },
      },
    },
    async (request: FastifyRequest) => {
      const user = requireUser(request);

      // Fetch profile from Supabase
      const { data: profile, error } = await fastify.supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw fastify.httpErrors.notFound('Profile not found');
        }
        fastify.log.error(error);
        throw fastify.httpErrors.internalServerError('Failed to fetch profile');
      }

      return {
        id: profile.id,
        email: user.email,
        username: profile.username || '',
        avatar: profile.avatar || '',
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      };
    },
  );
}
