import { Capacitor } from "@capacitor/core";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { rawajAuthStorage } from "@/lib/native-runtime";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function hasUsableEnvValue(value: string | undefined, placeholder: string) {
  return Boolean(value && value.trim() && value.trim() !== placeholder);
}

const hasSupabaseUrl = hasUsableEnvValue(supabaseUrl, "https://YOUR_PROJECT_REF.supabase.co");
const hasSupabaseAnonKey = hasUsableEnvValue(supabaseAnonKey, "YOUR_SUPABASE_ANON_KEY");

export const isSupabaseConfigured = hasSupabaseUrl && hasSupabaseAnonKey;

const isNativeRuntime = typeof window !== "undefined" && Capacitor.isNativePlatform();

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: !isNativeRuntime,
        storage: isNativeRuntime ? rawajAuthStorage : undefined,
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
