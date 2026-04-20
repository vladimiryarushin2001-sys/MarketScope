import { supabase } from './supabase';

function getSupabaseUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!url) throw new Error('Supabase не настроен: отсутствует VITE_SUPABASE_URL');
  return url.replace(/\/+$/, '');
}

function getAnonKey(): string {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!key) throw new Error('Supabase не настроен: отсутствует VITE_SUPABASE_ANON_KEY');
  return key;
}

/**
 * Supabase Edge Gateway может отклонять access tokens с ES256 (401 UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM)
 * ещё до выполнения функции. Поэтому вызываем функцию "публично" (только apikey),
 * а user jwt передаём отдельным заголовком X-User-JWT.
 */
export async function invokeEdgeFunction<T>(name: string, body: unknown): Promise<T> {
  const supabaseUrl = getSupabaseUrl();
  const anonKey = getAnonKey();
  const { data } = await supabase.auth.getSession();
  const userJwt = data.session?.access_token ?? '';

  const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      ...(userJwt ? { 'X-User-JWT': userJwt } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof (json as any)?.error === 'string' ? (json as any).error : `Edge Function error (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

