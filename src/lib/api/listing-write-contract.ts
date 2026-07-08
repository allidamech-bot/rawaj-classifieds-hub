export interface OwnerUpdateRpcArgs {
  p_listing_id: string;
  p_patch: Record<string, unknown>;
}

export function buildOwnerUpdateRpcArgs(
  listingId: string,
  patch: Record<string, unknown> | null | undefined,
): OwnerUpdateRpcArgs {
  const p_listing_id = listingId.trim();
  if (!p_listing_id) {
    throw new Error("Owner listing update RPC requires p_listing_id.");
  }

  const p_patch = patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};

  return { p_listing_id, p_patch };
}
