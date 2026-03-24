import { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import authPlugin from './plugins/auth';
import authRoutes from './routes/auth';
import groupRoutes from './routes/groups';
import channelRoutes from './routes/channels';
import rootRoutes from './routes/root';
import { registerSharedSchemas } from './schemas';

export async function app(fastify: FastifyInstance) {
  // Register plugins first (order matters: sensible → auth)
  // Note: supabasePlugin is registered at root level in main.ts
  fastify.register(sensible);
  fastify.register(authPlugin);

  // Register shared JSON schemas for validation and serialization
  registerSharedSchemas(fastify);

  // Register routes
  fastify.register(authRoutes, { prefix: '/auth' });
  fastify.register(groupRoutes, { prefix: '/groups' });
  fastify.register(channelRoutes, { prefix: '/channels' });
  fastify.register(rootRoutes);
}
