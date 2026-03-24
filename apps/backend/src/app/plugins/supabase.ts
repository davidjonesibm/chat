import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../database.types';

declare module 'fastify' {
  interface FastifyInstance {
    supabaseAdmin: SupabaseClient<Database>;
  }
}

const supabasePlugin: FastifyPluginAsync = async (fastify) => {
  const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
  const supabaseServiceKey = process.env.SUPABASE_SECRET;
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SECRET is required');
  }
  const client = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  fastify.decorate('supabaseAdmin', client);
  fastify.log.info(`Supabase client connected to ${supabaseUrl}`);
};

export default fp(supabasePlugin, { name: 'supabase-plugin' });
