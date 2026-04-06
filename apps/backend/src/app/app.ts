import { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import multipart from '@fastify/multipart';
import authPlugin from './plugins/auth';
import authRoutes from './routes/auth';
import groupRoutes from './routes/groups';
import channelRoutes from './routes/channels';
import pushRoutes from './routes/push';
import searchRoutes from './routes/search';
import inviteRoutes from './routes/invites';
import imageRoutes from './routes/images';
import rootRoutes from './routes/root';
import { registerSharedSchemas } from './schemas';

export async function app(fastify: FastifyInstance) {
  // Register plugins first (order matters: sensible → auth)
  // Note: supabasePlugin and pushPlugin are registered at root level in main.ts
  fastify.register(sensible);
  fastify.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });
  fastify.register(authPlugin);

  // Register shared JSON schemas for validation and serialization
  registerSharedSchemas(fastify);

  // Register routes
  fastify.register(authRoutes, { prefix: '/auth' });
  fastify.register(groupRoutes, { prefix: '/groups' });
  fastify.register(channelRoutes, { prefix: '/channels' });
  fastify.register(pushRoutes, { prefix: '/push' });
  fastify.register(searchRoutes, { prefix: '/search' });
  fastify.register(inviteRoutes, { prefix: '/invites' });
  fastify.register(imageRoutes, { prefix: '/images' });
  fastify.register(rootRoutes);
}
