import Fastify from 'fastify';
import { app } from './app/app';
import socketPlugin from './app/plugins/socket';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// Instantiate Fastify with some config
const server = Fastify({
  logger: true,
});

// Add CORS support via hook
server.addHook('onSend', async (request, reply) => {
  const origin = request.headers.origin || '*';
  const allowedOrigins = [
    'http://localhost:4200',
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  if (allowedOrigins.includes(origin) || origin === '*') {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    );
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
});

// Handle preflight OPTIONS requests
server.options('*', async (request, reply) => {
  reply.send();
});

// Health check route
server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register WebSocket plugin at root level (must NOT be under /api prefix)
server.register(socketPlugin);

// Register your application as a normal plugin with /api prefix
server.register(app, { prefix: '/api' });

// Start listening
server.listen({ port, host }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  } else {
    console.log(`[ ready ] http://${host}:${port}`);
  }
});
