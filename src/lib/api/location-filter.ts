import type { SupabaseClient } from "@supabase/supabase-js";
import { rowString } from "@/lib/api/shared";

export async function resolveLocationSubtreeIds(
  client: SupabaseClient,
  governorateId: string | undefined,
  locationLabel: string | undefined,
): Promise<string[]> {
  const label = locationLabel?.trim();
  if (!governorateId || !label) return [];

  const resolved = await client.rpc("rawaj_resolve_location_option", {
    legacy_governorate: governorateId,
    option_label: label,
  });
  if (resolved.error || !resolved.data) return [];

  const rootId = String(resolved.data);
  const descendants = await client.rpc("rawaj_location_descendant_ids", { root_id: rootId });
  if (descendants.error || !descendants.data) return [rootId];

  return ((descendants.data ?? []) as Record<string, unknown>[])
    .map((row) => rowString(row, "id"))
    .filter(Boolean);
}
