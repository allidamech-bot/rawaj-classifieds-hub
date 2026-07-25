import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { fetchLocationNode, resolveLocationDescendantIds } from "@/lib/api/location-taxonomy";

/**
 * Compatibility signature retained for callers that previously passed a database client.
 * Location validation and subtree resolution are now Cloudflare Worker + D1 only.
 */
export async function resolveCanonicalLocationIds(
  _retiredClient: unknown,
  nodeId: string,
): Promise<ClassifiedsResult<string[]>> {
  const cleanNodeId = nodeId.trim();
  if (!cleanNodeId) return invalidLocation();
  const node = await fetchLocationNode(cleanNodeId);
  if (!node.ok || !node.data || !node.data.isActive) return invalidLocation();
  const descendants = await resolveLocationDescendantIds(cleanNodeId);
  if (!descendants.ok) return descendants;
  return descendants.data.length > 0 ? descendants : invalidLocation();
}

function invalidLocation(): ClassifiedsResult<string[]> {
  return {
    ok: false,
    error: { code: "validation_error", message: "الموقع المحدد غير صالح أو غير متاح." },
  };
}
