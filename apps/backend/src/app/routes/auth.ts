import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type {
  User,
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
} from '@chat/shared';

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
  fastify.post<{ Body: RegisterBody }>(
    '/register',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            username: { type: 'string' },
          },
          required: ['email', 'password', 'username'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  username: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
              token: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: RegisterBody }>,
      reply: FastifyReply,
    ) => {
      try {
        const { email, password, username } = request.body;

        // Validate inputs
        if (!email || !email.includes('@')) {
          reply.code(400).send({
            error: 'Validation Error',
            message: 'Invalid email format',
          });
          return;
        }

        if (!password || password.length < 8) {
          reply.code(400).send({
            error: 'Validation Error',
            message: 'Password must be at least 8 characters',
          });
          return;
        }

        if (!username || username.trim().length === 0) {
          reply.code(400).send({
            error: 'Validation Error',
            message: 'Username is required',
          });
          return;
        }

        // Create user in PocketBase
        const pb = fastify.pb;
        const userData = {
          email: email.toLowerCase(),
          password,
          passwordConfirm: password,
          username: username.trim(),
        };

        const user = await pb.collection('users').create(userData);

        // Authenticate the newly created user
        const authData = await pb
          .collection('users')
          .authWithPassword(email.toLowerCase(), password);

        const response: RegisterResponse = {
          user: {
            id: authData.record.id,
            email: authData.record.email,
            username: authData.record.username,
            avatar: authData.record.avatar || undefined,
            createdAt: authData.record.created,
            updated: authData.record.updated,
          },
          token: authData.token,
        };

        reply.code(201).send(response);
      } catch (err: any) {
        fastify.log.error({ err }, 'Register error');

        // Handle duplicate email error from PocketBase
        if (err.status === 400 && err.data?.data?.email) {
          reply.code(400).send({
            error: 'Validation Error',
            message: 'Email already exists',
          });
          return;
        }

        // Generic validation error
        if (err.status === 400) {
          reply.code(400).send({
            error: 'Validation Error',
            message: err.message || 'Invalid registration data',
          });
          return;
        }

        reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to register user',
        });
      }
    },
  );

  /**
   * POST /api/auth/login
   * Authenticate user with email and password
   */
  fastify.post<{ Body: LoginBody }>(
    '/login',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
          required: ['email', 'password'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  username: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
              token: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: LoginBody }>,
      reply: FastifyReply,
    ) => {
      try {
        const { email, password } = request.body;

        // Validate inputs
        if (!email || !password) {
          reply.code(401).send({
            error: 'Unauthorized',
            message: 'Invalid email or password',
          });
          return;
        }

        // Authenticate with PocketBase
        const pb = fastify.pb;
        const authData = await pb
          .collection('users')
          .authWithPassword(email.toLowerCase(), password);

        const response: LoginResponse = {
          user: {
            id: authData.record.id,
            email: authData.record.email,
            username: authData.record.username,
            avatar: authData.record.avatar || undefined,
            createdAt: authData.record.created,
            updated: authData.record.updated,
          },
          token: authData.token,
        };

        reply.code(200).send(response);
      } catch (err: any) {
        fastify.log.error({ err }, 'Login error');

        // PocketBase returns 400 for invalid credentials
        if (err.status === 400 || err.status === 401) {
          reply.code(401).send({
            error: 'Unauthorized',
            message: 'Invalid email or password',
          });
          return;
        }

        reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to authenticate',
        });
      }
    },
  );

  /**
   * GET /api/auth/me
   * Get current authenticated user profile (protected route)
   */
  fastify.get(
    '/me',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              username: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // User is attached by auth middleware
        if (!request.user) {
          reply.code(401).send({
            error: 'Unauthorized',
            message: 'No user context',
          });
          return;
        }

        reply.code(200).send({
          id: request.user.id,
          email: request.user.email,
          username: request.user.username,
          avatar: request.user.avatar,
          createdAt: request.user.createdAt,
        });
      } catch (err: any) {
        fastify.log.error({ err }, 'Get user error');
        reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch user',
        });
      }
    },
  );
}
