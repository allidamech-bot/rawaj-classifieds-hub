export interface OwnerUpdateRpcArgs {
  p_listing_id: string;
  p_patch: Record<string, unknown>;
}

export interface OwnerUpdateRpcArgsV3 extends OwnerUpdateRpcArgs {
  p_expected_updated_at: string;
}

export function buildOwnerUpdateRpcArgs(
  listingId: string,
  patch: Record<string, unknown> | null | undefined,
): OwnerUpdateRpcArgs {
  const p_listing_id = listingId.trim();
  if (!p_listing_id) {
    throw new Error("Owner listing update RPC requires p_listing_id.");
  }

  const p_patch =
    patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};

  return { p_listing_id, p_patch };
}

export function buildOwnerUpdateRpcArgsV3(
  listingId: string,
  patch: Record<string, unknown> | null | undefined,
  expectedUpdatedAt: string,
): OwnerUpdateRpcArgsV3 {
  const base = buildOwnerUpdateRpcArgs(listingId, patch);
  const p_expected_updated_at = expectedUpdatedAt.trim();
  if (!p_expected_updated_at) {
    throw new Error(
      "Owner listing update RPC requires p_expected_updated_at.",
    );
  }

  return { ...base, p_expected_updated_at };
}
