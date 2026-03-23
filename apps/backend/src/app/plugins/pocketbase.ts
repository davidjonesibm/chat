import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import PocketBase from 'pocketbase';

/**
 * PocketBase plugin - initializes and provides PocketBase client
 * Adds `fastify.pb` to access PocketBase throughout the app
 */
export default fp(async function (fastify: FastifyInstance) {
  const pocketbaseUrl = process.env.POCKETBASE_URL || 'http://localhost:8090';

  try {
    const pb = new PocketBase(pocketbaseUrl);

    // Decorate fastify instance with pb client
    fastify.decorate('pb', pb);

    fastify.log.info(`PocketBase connected to ${pocketbaseUrl}`);

    // Graceful cleanup on shutdown
    fastify.addHook('onClose', async () => {
      pb.authStore.clear();
      fastify.log.info('PocketBase client cleaned up');
    });
  } catch (err) {
    fastify.log.error({ err }, 'Failed to initialize PocketBase');
    throw err;
  }
}, {
  name: 'pocketbase-plugin',
});

// TypeScript module augmentation to add pb to FastifyInstance
declare module 'fastify' {
  interface FastifyInstance {
    pb: PocketBase;
  }
}
