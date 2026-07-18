import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function hasUsableEnvValue(value: string | undefined, placeholder: string) {
  return Boolean(value && value.trim() && value.trim() !== placeholder);
}

const hasSupabaseUrl = hasUsableEnvValue(supabaseUrl, "https://YOUR_PROJECT_REF.supabase.co");
const hasSupabaseAnonKey = hasUsableEnvValue(supabaseAnonKey, "YOUR_SUPABASE_ANON_KEY");

export const isSupabaseConfigured = hasSupabaseUrl && hasSupabaseAnonKey;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Public marketplace reads must not inherit or wait on an account session.
 * This client never persists or refreshes authentication and therefore keeps
 * public ad placements stable while sign-in state is being established.
 */
export const publicSupabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "rawaj-public-read-client",
      },
    })
  : null;

export function getSupabaseAuthUnavailableReason() {
  if (isSupabaseConfigured) return null;
  if (!hasSupabaseUrl && !hasSupabaseAnonKey) {
    return "تعذر الوصول إلى خدمة الحسابات والبيانات الآن. التصفح العام متاح ويمكنك المحاولة مرة أخرى.";
  }

  if (!hasSupabaseUrl) {
    return "تعذر الوصول إلى اتصال Supabase الآن. التصفح العام متاح ويمكنك المحاولة مرة أخرى.";
  }

  return "تعذر الوصول إلى خدمة الحسابات الآن. يمكنك تصفح رَوَاج والمحاولة مرة أخرى.";
}
