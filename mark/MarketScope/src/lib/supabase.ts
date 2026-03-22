import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** true только если заданы оба значения в .env (иначе фичи БД/авторизации отключены осознанно) */
export const isSupabaseConfigured = Boolean(envUrl && envKey);

/**
 * Supabase требует непустые URL и ключ при createClient().
 * Без .env приложение всё равно должно монтироваться (лендинг / PreviewPage),
 * поэтому подставляем безопасные заглушки — запросы к ним не пойдут, пока нет сессии,
 * а хуки с isSupabaseConfigured могут ранний выход.
 */
const supabaseUrl =
  envUrl || 'https://local-placeholder.supabase.co';
const supabaseAnonKey =
  envKey ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
