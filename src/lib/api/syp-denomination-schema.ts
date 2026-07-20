import type { SupabaseClient } from "@supabase/supabase-js";

const supportChecks = new WeakMap<object, Promise<boolean>>();

/**
 * Detects whether the connected database has the additive Phase A columns.
 *
 * Pull-request previews intentionally continue to use the current Production
 * database before the reviewed migration is applied. Public reads therefore
 * need to work against both the legacy and Phase A schemas during rollout.
 */
export function supportsSypDenominationSchema(client: SupabaseClient): Promise<boolean> {
  const cached = supportChecks.get(client);
  if (cached) return cached;

  const check = (async () => {
    try {
      const { error } = await client.from("listings").select("price_denomination").limit(0);
      return error === null;
    } catch {
      return false;
    }
  })();

  supportChecks.set(client, check);
  return check;
}
