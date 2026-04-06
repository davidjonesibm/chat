import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export const supabase = createClient(
  SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storageKey: 'chat-auth',
    },
  },
);

export function toStorageUrl(
  path: string | null | undefined,
): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  return `${SUPABASE_URL}${path}`;
}
