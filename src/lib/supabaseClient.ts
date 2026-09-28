import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseClient = url && anonKey
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export async function getAccessToken() {
  if (!supabaseClient) return localStorage.getItem('access_token');
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.access_token || localStorage.getItem('access_token');
}
