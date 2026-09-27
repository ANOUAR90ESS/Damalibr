import { supabase } from '../supabase';
import { apiUrl } from '../platform';

/**
 * Calls our own Express API as JSON, sending the Supabase access token when signed in.
 * Throws an Error with the server's message on non-2xx responses.
 */
export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, requireAuth = false }: { method?: string; body?: unknown; requireAuth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.authorization = `Bearer ${token}`;
    else if (requireAuth) throw new Error('Inicia sesión para continuar.');
  }

  const res = await fetch(apiUrl(path), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Error del servidor (${res.status}).`);
  return json as T;
}
