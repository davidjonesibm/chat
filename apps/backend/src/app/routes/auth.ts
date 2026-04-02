import { FastifyInstance, FastifyRequest } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import type {
  RegisterRequest,
  LoginRequest,
  UpdateProfileRequest,
} from '@chat/shared';

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

  /**
   * PATCH /api/auth/profile
   * Update current user's profile (protected route)
   */
  fastify.patch<{ Body: UpdateProfileRequest }>(
    '/profile',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          properties: {
            username: { type: 'string', minLength: 1 },
            name: { type: 'string', minLength: 1 },
            avatar: { type: 'string' },
          },
          anyOf: [
            { required: ['username'] },
            { required: ['name'] },
            { required: ['avatar'] },
          ],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              user: { $ref: 'user#' },
            },
          },
          400: { $ref: 'error#' },
          401: { $ref: 'error#' },
        },
      },
    },
    async (request, reply) => {
      const user = requireUser(request);
      const { username, name, avatar } = request.body;

      // Build profile update payload (only provided fields)
      const profileUpdate: Record<string, string> = {};
      if (username !== undefined) profileUpdate.username = username.trim();
      if (name !== undefined) profileUpdate.name = name.trim();
      if (avatar !== undefined) profileUpdate.avatar = avatar;

      // Update profiles table
      const { data: profile, error: profileError } = await fastify.supabaseAdmin
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id)
        .select('*')
        .single();

      if (profileError) {
        fastify.log.error(profileError, 'Profile update failed');
        throw fastify.httpErrors.internalServerError(
          'Failed to update profile',
        );
      }

      // Sync user_metadata for fields that live on auth.users
      const metadataUpdate: Record<string, string> = {};
      if (username !== undefined) metadataUpdate.username = username.trim();
      if (name !== undefined) metadataUpdate.name = name.trim();
      if (avatar !== undefined) metadataUpdate.avatar = avatar;

      if (Object.keys(metadataUpdate).length > 0) {
        const { error: authError } =
          await fastify.supabaseAdmin.auth.admin.updateUserById(user.id, {
            user_metadata: metadataUpdate,
          });

        if (authError) {
          fastify.log.error(authError, 'User metadata update failed');
          // Profile was updated, metadata sync failed — log but don't fail the request
        }
      }

      return {
        user: {
          id: profile.id,
          email: user.email,
          username: profile.username || '',
          avatar: profile.avatar || '',
          created_at: profile.created_at,
          updated_at: profile.updated_at,
        },
      };
    },
  );

  /**
   * POST /api/auth/avatar
   * Upload avatar image (protected route, multipart/form-data)
   */
  const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ] as const;

  const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  fastify.post(
    '/avatar',
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              url: { type: 'string' },
            },
          },
          400: { $ref: 'error#' },
          401: { $ref: 'error#' },
        },
      },
    },
    async (request, reply) => {
      const user = requireUser(request);

      const file = await request.file();
      if (!file) {
        throw fastify.httpErrors.badRequest('No file uploaded');
      }

      // Validate mime type on server side
      if (
        !ALLOWED_MIME_TYPES.includes(
          file.mimetype as (typeof ALLOWED_MIME_TYPES)[number],
        )
      ) {
        throw fastify.httpErrors.badRequest(
          `Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
        );
      }

      // Consume the file stream into a buffer
      const buffer = await file.toBuffer();

      // Validate file size (also enforced by multipart limits, but double-check)
      if (buffer.byteLength > 2 * 1024 * 1024) {
        throw fastify.httpErrors.badRequest(
          'File too large. Maximum size is 2MB.',
        );
      }

      const ext = MIME_TO_EXT[file.mimetype];
      const storagePath = `${user.id}/avatar.${ext}`;

      // Upload to Supabase Storage with upsert
      const { error: uploadError } = await fastify.supabaseAdmin.storage
        .from('avatars')
        .upload(storagePath, buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        fastify.log.error(uploadError, 'Avatar upload failed');
        throw fastify.httpErrors.internalServerError('Failed to upload avatar');
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = fastify.supabaseAdmin.storage
        .from('avatars')
        .getPublicUrl(storagePath);

      // Update profiles table
      const { error: profileError } = await fastify.supabaseAdmin
        .from('profiles')
        .update({ avatar: publicUrl })
        .eq('id', user.id);

      if (profileError) {
        fastify.log.error(profileError, 'Profile avatar update failed');
        throw fastify.httpErrors.internalServerError(
          'Failed to update profile avatar',
        );
      }

      // Sync auth.users metadata
      const { error: authError } =
        await fastify.supabaseAdmin.auth.admin.updateUserById(user.id, {
          user_metadata: { avatar: publicUrl },
        });

      if (authError) {
        fastify.log.error(authError, 'User metadata avatar update failed');
      }

      return { url: publicUrl };
    },
  );
}
