import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { mapError, rowString } from "@/lib/api/shared";

export async function resolveCanonicalLocationIds(
  client: SupabaseClient,
  nodeId: string,
): Promise<ClassifiedsResult<string[]>> {
  const node = await client
    .from("location_nodes")
    .select("id")
    .eq("id", nodeId)
    .eq("is_active", true)
    .maybeSingle();

  if (node.error) return { ok: false, error: mapError(node.error) };
  if (!node.data) {
    return {
      ok: false,
      error: { code: "validation_error", message: "Invalid or inactive location." },
    };
  }

  const descendants = await client.rpc("rawaj_location_descendant_ids", { root_id: nodeId });
  if (descendants.error) return { ok: false, error: mapError(descendants.error) };

  const ids = ((descendants.data ?? []) as Record<string, unknown>[])
    .map((row) => rowString(row, "id"))
    .filter(Boolean);

  return ids.length > 0
    ? { ok: true, data: ids }
    : {
        ok: false,
        error: { code: "validation_error", message: "Location scope could not be resolved." },
      };
}
