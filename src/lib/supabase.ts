import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase runtime access is permanently disabled.
 *
 * Application data is served by Cloudflare Worker + D1 and media by R2.
 * Authentication is handled by the configured Firebase/Cloudflare auth layer.
 * These nullable exports remain temporarily for legacy modules while they are
 * migrated, preventing any accidental network call to Supabase.
 */
export const isSupabaseConfigured = false;
export const supabase: SupabaseClient | null = null;
export const publicSupabase: SupabaseClient | null = null;

export function getSupabaseAuthUnavailableReason() {
  return "هذه الوظيفة القديمة لم تعد تستخدم Supabase. استخدم خدمة رَوَاج على Cloudflare.";
}
