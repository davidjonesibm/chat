import Fastify from 'fastify';
import cors from '@fastify/cors';
import { app } from './app/app';
import socketPlugin from './app/plugins/socket';
import supabasePlugin from './app/plugins/supabase';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// Instantiate Fastify with some config
const server = Fastify({
  logger: true,
});

// Register CORS plugin
server.register(cors, {
  origin: [
    'http://localhost:4200',
    'http://localhost:5173',
    'http://localhost:3000',
  ],
  credentials: true,
});

// Health check route
server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register supabase first so socket-plugin's dependency is satisfied
server.register(supabasePlugin);

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
