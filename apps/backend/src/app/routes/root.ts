import { FastifyInstance } from 'fastify';

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async function () {
    return { message: 'Hello API' };
  });

  fastify.get('/health', async function () {
    return { status: 'ok' };
  });
}
