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

export function getSupabaseAuthUnavailableReason() {
  if (isSupabaseConfigured) return null;
  if (!hasSupabaseUrl && !hasSupabaseAnonKey) {
    return "Supabase غير مهيأ حالياً. يلزم ضبط VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY.";
  }

  if (!hasSupabaseUrl) {
    return "Supabase غير مهيأ حالياً. يلزم ضبط VITE_SUPABASE_URL بقيمة المشروع العامة.";
  }

  return "Supabase غير مهيأ حالياً. يلزم ضبط VITE_SUPABASE_ANON_KEY بالمفتاح العام anon.";
}
