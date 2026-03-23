import { FastifyInstance } from 'fastify';
import sensiblePlugin from './plugins/sensible';
import pocketbasePlugin from './plugins/pocketbase';
import authPlugin from './plugins/auth';
import authRoutes from './routes/auth';
import channelRoutes from './routes/channels';
import rootRoutes from './routes/root';

/* eslint-disable-next-line */
export interface AppOptions {}

export async function app(fastify: FastifyInstance, opts: AppOptions) {
  // Register plugins first (order matters: sensible → pocketbase → auth)
  fastify.register(sensiblePlugin);
  fastify.register(pocketbasePlugin);
  fastify.register(authPlugin);

  // Register routes
  fastify.register(authRoutes, { prefix: '/auth' });
  fastify.register(channelRoutes, { prefix: '/channels' });
  fastify.register(rootRoutes);
}
