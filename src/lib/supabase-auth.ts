import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { installPasswordRecoverySessionBridge } from "./auth-recovery-session";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function hasUsableValue(value: string | undefined, placeholder: string): boolean {
  return Boolean(value && value.trim() && value.trim() !== placeholder);
}

const hasSupabaseUrl = hasUsableValue(supabaseUrl, "https://YOUR_PROJECT_REF.supabase.co");
const hasSupabaseAnonKey = hasUsableValue(supabaseAnonKey, "YOUR_SUPABASE_ANON_KEY");

export const isSupabaseAuthConfigured = hasSupabaseUrl && hasSupabaseAnonKey;

const client: SupabaseClient | null = isSupabaseAuthConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  : null;

installPasswordRecoverySessionBridge(client);

export const supabaseAuth = client;

export function getSupabaseAuthUnavailableReason(): string | null {
  if (isSupabaseAuthConfigured) return null;
  if (!hasSupabaseUrl && !hasSupabaseAnonKey) {
    return "تعذر الوصول إلى خدمة الحسابات الآن. التصفح العام متاح ويمكنك المحاولة لاحقًا.";
  }
  if (!hasSupabaseUrl) {
    return "تعذر الوصول إلى اتصال Supabase Auth الآن. التصفح العام متاح.";
  }
  return "مفتاح Supabase Auth العام غير مضبوط. يمكنك تصفح رواج والمحاولة لاحقًا.";
}
