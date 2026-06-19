/**
 * Клиент Supabase. URL и anon key — из .env (SUPABASE_* или VITE_SUPABASE_*).
 */
import { createClient } from '@supabase/supabase-js';

/** Базовый URL проекта без /rest/v1 (SDK добавляет путь сам). */
function normalizeSupabaseUrl(url) {
  if (!url) return url;
  return url.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

const supabaseUrl = normalizeSupabaseUrl(
  import.meta.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL,
);
const supabaseAnonKey = (
  import.meta.env.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();

let client = null;

/** @returns {import('@supabase/supabase-js').SupabaseClient | null} */
export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }
  return client;
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseConfigError() {
  if (isSupabaseConfigured()) return null;
  return 'Не заданы SUPABASE_URL и SUPABASE_ANON_KEY в файле .env';
}
