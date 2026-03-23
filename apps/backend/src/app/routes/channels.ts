import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import PocketBase from 'pocketbase';

export default async function (fastify: FastifyInstance) {
  const pocketbaseUrl = process.env.POCKETBASE_URL || 'http://localhost:8090';

  /**
   * GET /api/channels
   * Returns all channels, with default channel listed first.
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.headers.authorization!.replace('Bearer ', '');
    const pb = new PocketBase(pocketbaseUrl);
    pb.authStore.save(token, null);

    const channels = await pb
      .collection('channels')
      .getFullList({ sort: '-is_default,name' });

    return reply.send(channels);
  });
}
