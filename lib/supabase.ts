import { createClient, SupabaseClient } from '@supabase/supabase-js';

let serverClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  if (!serverClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE env vars');
    serverClient = createClient(url, key);
  }
  return serverClient;
}

export function getAnonSupabase(): SupabaseClient {
  if (!anonClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE env vars');
    anonClient = createClient(url, key);
  }
  return anonClient;
}
