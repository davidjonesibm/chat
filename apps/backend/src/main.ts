import Fastify from 'fastify';
import cors from '@fastify/cors';
import { app } from './app/app';
import socketPlugin from './app/plugins/socket';
import supabasePlugin from './app/plugins/supabase';
import pushPlugin from './app/plugins/push';

const host = process.env.HOST ?? '0.0.0.0';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// CORS origins: configurable via comma-separated CORS_ORIGIN env var
const defaultOrigins = [
  'http://localhost:4200',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://192.168.86.20:8443',
];

function parseCorsOrigin(): boolean | string | string[] {
  const env = process.env.CORS_ORIGIN;
  if (!env) return defaultOrigins;
  if (env === '*') return true; // fastify/cors: true means allow all
  return env.split(',').map((o) => o.trim());
}

// Instantiate Fastify with some config
const server = Fastify({
  logger: true,
  trustProxy: true,
});

// Register CORS plugin
server.register(cors, {
  origin: parseCorsOrigin(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Health check route
server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register supabase and push first so socket-plugin's dependencies are satisfied
server.register(supabasePlugin);
server.register(pushPlugin);

// Register WebSocket plugin at root level (must NOT be under /api prefix)
server.register(socketPlugin);

// Register your application as a normal plugin with /api prefix
server.register(app, { prefix: '/api' });

// Graceful shutdown handler
function shutdown(signal: string) {
  server.log.info({ signal }, 'Received signal, shutting down');
  server.close().then(
    () => {
      server.log.info('Server closed successfully');
      process.exit(0);
    },
    (err) => {
      server.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    },
  );
}

// Start listening
server.listen({ port, host }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  } else {
    server.log.info({ host, port }, 'Server ready');

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
});
