import type { SupabaseClient } from "@supabase/supabase-js";

const sypDenominationSchemaEnabled = import.meta.env.VITE_RAWAJ_SYP_DENOMINATION_SCHEMA === "1";

/**
 * Returns the explicitly activated Phase A schema state.
 *
 * Pull-request previews intentionally use the current Production database before
 * the reviewed migration is applied. Probing a missing column makes compatibility
 * work, but it also writes an avoidable PostgreSQL error for every fresh SSR
 * client. Phase A therefore uses a two-step release gate instead:
 *
 * 1. Apply and verify the additive migration.
 * 2. Set VITE_RAWAJ_SYP_DENOMINATION_SCHEMA=1 and rebuild the client.
 *
 * The flag defaults to disabled, so deploying application code before the
 * migration keeps every read and write on the legacy schema without issuing an
 * invalid database query.
 */
export function supportsSypDenominationSchema(_client: SupabaseClient): Promise<boolean> {
  return Promise.resolve(sypDenominationSchemaEnabled);
}
