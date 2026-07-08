from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 anchor, found {count}")
    return text.replace(old, new, 1)


# 1) Shared types: preserve the selected expiry option.
path = Path("src/lib/classifieds-types.ts")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    "  renewedAt?: string | null;\n  createdAt: string;",
    "  renewedAt?: string | null;\n  expiryDays?: 30 | 60 | 90 | null;\n  createdAt: string;",
    "ClassifiedListing expiryDays",
)
path.write_text(text, encoding="utf-8")


# 2) Core listings mapping + public expiry guards.
path = Path("src/lib/api/listings.ts")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    'import { resolveListingLocationWrite } from "@/lib/api/listing-location-write";\n',
    'import { resolveListingLocationWrite } from "@/lib/api/listing-location-write";\nimport { isListingPastExpiry, publicListingExpiryFilter } from "@/lib/api/listing-expiry";\n',
    "listings expiry import",
)
text = replace_once(
    text,
    '''  const category = categories.find((item) => item.id === categoryId);
  const governorate = governorates.find((item) => item.id === governorateId);

  return {
''',
    '''  const category = categories.find((item) => item.id === categoryId);
  const governorate = governorates.find((item) => item.id === governorateId);
  const rawStatus = rowString(row, "status", "pending_review") as ClassifiedListing["status"];
  const expiresAt = rowNullableString(row, "expires_at");
  const status = rawStatus === "approved" && isListingPastExpiry(expiresAt) ? "expired" : rawStatus;

  return {
''',
    "effective expiry mapping prelude",
)
text = replace_once(
    text,
    '    status: rowString(row, "status", "pending_review") as ClassifiedListing["status"],\n',
    '    status,\n',
    "effective status mapping",
)
text = replace_once(
    text,
    '    expiresAt: rowNullableString(row, "expires_at"),\n    renewedAt: rowNullableString(row, "renewed_at"),\n',
    '    expiresAt,\n    renewedAt: rowNullableString(row, "renewed_at"),\n    expiryDays: rowNullableNumber(row, "expiry_days") as 30 | 60 | 90 | null,\n',
    "expiry days mapping",
)
text = replace_once(
    text,
    '  let query = clientResult.data.from("listings").select("*").eq("status", "approved");\n',
    '  let query = clientResult.data\n    .from("listings")\n    .select("*")\n    .eq("status", "approved")\n    .or(publicListingExpiryFilter());\n',
    "public listing collection expiry guard",
)
text = replace_once(
    text,
    '''    .eq("id", listingId)
    .eq("status", "approved")
    .maybeSingle();
''',
    '''    .eq("id", listingId)
    .eq("status", "approved")
    .or(publicListingExpiryFilter())
    .maybeSingle();
''',
    "public listing detail expiry guard",
)
path.write_text(text, encoding="utf-8")


# 3) Favorites: expired approved rows are unavailable and cannot be newly saved.
path = Path("src/lib/api/favorites.ts")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    'import { hydrateListingsWithPrimaryImages, mapListing } from "@/lib/api/listings";\n',
    'import { hydrateListingsWithPrimaryImages, mapListing } from "@/lib/api/listings";\nimport { publicListingExpiryFilter } from "@/lib/api/listing-expiry";\n',
    "favorites expiry import",
)
# Exactly three listing-approved query chains exist in this file.
anchor = '.eq("status", "approved")'
if text.count(anchor) != 3:
    raise RuntimeError(f"favorites approved anchors: expected 3, found {text.count(anchor)}")
text = text.replace(anchor, '.eq("status", "approved")\n    .or(publicListingExpiryFilter())')
path.write_text(text, encoding="utf-8")


# 4) Public seller storefront listings.
path = Path("src/lib/api/seller.ts")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    'import { hydrateListingsWithPrimaryImages, mapListing } from "@/lib/api/listings";\n',
    'import { hydrateListingsWithPrimaryImages, mapListing } from "@/lib/api/listings";\nimport { publicListingExpiryFilter } from "@/lib/api/listing-expiry";\n',
    "seller expiry import",
)
text = replace_once(
    text,
    '''    .eq("owner_id", cleanSellerId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
''',
    '''    .eq("owner_id", cleanSellerId)
    .eq("status", "approved")
    .or(publicListingExpiryFilter())
    .order("created_at", { ascending: false })
''',
    "seller listing expiry guard",
)
path.write_text(text, encoding="utf-8")


# 5) Legacy location-aware public discovery.
path = Path("src/lib/api/location-aware-listings.ts")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    'import { resolveLocationSubtreeIds } from "@/lib/api/location-filter";\n',
    'import { resolveLocationSubtreeIds } from "@/lib/api/location-filter";\nimport { publicListingExpiryFilter } from "@/lib/api/listing-expiry";\n',
    "location-aware expiry import",
)
text = replace_once(
    text,
    '  let query = client.from("listings").select("*").eq("status", "approved");\n',
    '  let query = client\n    .from("listings")\n    .select("*")\n    .eq("status", "approved")\n    .or(publicListingExpiryFilter());\n',
    "location-aware expiry guard",
)
path.write_text(text, encoding="utf-8")


# 6) Canonical location-aware public discovery.
path = Path("src/lib/api/location-aware-listings-v2.ts")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    'import { fetchPublicListingsLocationAware } from "@/lib/api/location-aware-listings";\n',
    'import { fetchPublicListingsLocationAware } from "@/lib/api/location-aware-listings";\nimport { publicListingExpiryFilter } from "@/lib/api/listing-expiry";\n',
    "canonical expiry import",
)
text = replace_once(
    text,
    '''    .select("*")
    .eq("status", "approved")
    .in("location_node_id", idsResult.data);
''',
    '''    .select("*")
    .eq("status", "approved")
    .or(publicListingExpiryFilter())
    .in("location_node_id", idsResult.data);
''',
    "canonical expiry guard",
)
path.write_text(text, encoding="utf-8")


# 7) Lifecycle API: set/renew expiry options, guard confirmation, and recover due listings via review.
path = Path("src/lib/api/listing-lifecycle.ts")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    'import { getClient, mapError } from "@/lib/api/shared";\n',
    'import { getClient, mapError } from "@/lib/api/shared";\nimport { publicListingExpiryFilter, resolveListingExpiryDate, type ListingExpiryOption } from "@/lib/api/listing-expiry";\n',
    "lifecycle expiry imports",
)
text = replace_once(
    text,
    '''export function reactivateOwnerListing(userId: string | null, listingId: string) {
  return transitionOwnerListing(
    userId,
    listingId,
    ["sold", "rented", "unavailable", "expired"],
    "pending_review",
  );
}
''',
    '''export async function reactivateOwnerListing(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return { ok: false, error: { code: "auth_required", message: "يجب تسجيل الدخول لإعادة تفعيل الإعلان." } };
  }
  const cleanListingId = listingId.trim();
  if (!cleanListingId) {
    return { ok: false, error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." } };
  }
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const payload = {
    status: "pending_review",
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    expires_at: null,
  };

  let result = await clientResult.data
    .from("listings")
    .update(payload)
    .eq("id", cleanListingId)
    .eq("owner_id", userId)
    .in("status", ["sold", "rented", "unavailable", "expired"])
    .select("id")
    .maybeSingle();

  if (!result.error && !result.data) {
    result = await clientResult.data
      .from("listings")
      .update(payload)
      .eq("id", cleanListingId)
      .eq("owner_id", userId)
      .eq("status", "approved")
      .lte("expires_at", new Date().toISOString())
      .select("id")
      .maybeSingle();
  }

  if (result.error) return { ok: false, error: mapError(result.error) };
  if (!result.data) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "تعذر إعادة تفعيل الإعلان. ربما تغيرت حالته أو لم تعد العملية متاحة.",
      },
    };
  }
  return fetchOwnerListingDetail(userId, cleanListingId);
}

export async function setOwnerListingExpiry(
  userId: string | null,
  listingId: string,
  option: ListingExpiryOption,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return { ok: false, error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث مدة الإعلان." } };
  }
  const cleanListingId = listingId.trim();
  if (!cleanListingId) {
    return { ok: false, error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." } };
  }
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const now = new Date();
  const { data, error } = await clientResult.data
    .from("listings")
    .update({
      expiry_days: option === "never" ? null : option,
      expires_at: resolveListingExpiryDate(option, now),
      renewed_at: now.toISOString(),
    })
    .eq("id", cleanListingId)
    .eq("owner_id", userId)
    .eq("status", "approved")
    .or(publicListingExpiryFilter(now.toISOString()))
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "لا يمكن تحديث مدة هذا الإعلان حالياً. إذا انتهت مدته فأعد تفعيله للمراجعة أولاً.",
      },
    };
  }
  return fetchOwnerListingDetail(userId, cleanListingId);
}
''',
    "reactivation and expiry setter",
)
text = replace_once(
    text,
    '''    .eq("owner_id", userId)
    .eq("status", "approved")
    .select("id")
''',
    '''    .eq("owner_id", userId)
    .eq("status", "approved")
    .or(publicListingExpiryFilter())
    .select("id")
''',
    "availability confirmation expiry guard",
)
path.write_text(text, encoding="utf-8")


# 8) My Listings UI: explicit option picker + renew/apply action.
path = Path("src/routes/profile/listings.tsx")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    '''  closeOwnerListing,
  confirmOwnerListingAvailability,
  deleteOwnerListing,
''',
    '''  closeOwnerListing,
  deleteOwnerListing,
''',
    "remove confirmation import",
)
text = replace_once(
    text,
    '''  reactivateOwnerListing,
  type OwnerCloseListingStatus,
''',
    '''  reactivateOwnerListing,
  setOwnerListingExpiry,
  type OwnerCloseListingStatus,
''',
    "add expiry setter import",
)
text = replace_once(
    text,
    'import { isClosedListingStatus, isReactivatableListingStatus } from "@/lib/listing-lifecycle-ui";\n',
    'import { isClosedListingStatus, isReactivatableListingStatus } from "@/lib/listing-lifecycle-ui";\nimport type { ListingExpiryOption } from "@/lib/api/listing-expiry";\n',
    "expiry option type import",
)
text = replace_once(
    text,
    '''  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [lifecycleError, setLifecycleError] = useState("");
''',
    '''  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [lifecycleError, setLifecycleError] = useState("");
  const [expiryOption, setExpiryOption] = useState<ListingExpiryOption>(
    listing.expiryDays ?? "never",
  );

  useEffect(() => {
    setExpiryOption(listing.expiryDays ?? "never");
  }, [listing.expiryDays]);
''',
    "expiry option state",
)
text = replace_once(
    text,
    '''  async function handleConfirmAvailability() {
    if (lifecycleBusy || listing.status !== "approved") return;
    setLifecycleError("");
    setLifecycleBusy(true);
    const result = await confirmOwnerListingAvailability(userId, listing.id);
    setLifecycleBusy(false);
    if (!result.ok) {
      setLifecycleError(result.error.message);
      return;
    }
    onChanged(result.data);
  }
''',
    '''  async function handleExpiryUpdate() {
    if (lifecycleBusy || listing.status !== "approved") return;
    setLifecycleError("");
    setLifecycleBusy(true);
    const result = await setOwnerListingExpiry(userId, listing.id, expiryOption);
    setLifecycleBusy(false);
    if (!result.ok) {
      setLifecycleError(result.error.message);
      return;
    }
    onChanged(result.data);
  }
''',
    "expiry update handler",
)
text = replace_once(
    text,
    '''                <button
                  type="button"
                  disabled={lifecycleBusy}
                  onClick={() => void handleConfirmAvailability()}
                  className="rounded-lg bg-emerald-trust/10 px-2 py-1 text-[10px] font-bold text-emerald-trust disabled:opacity-60"
                >
                  {lifecycleBusy
                    ? text("جارٍ التحديث", "Updating")
                    : text("تأكيد استمرار التوفر", "Confirm availability")}
                </button>
''',
    '''                <select
                  value={String(expiryOption)}
                  disabled={lifecycleBusy}
                  onChange={(event) => {
                    const value = event.target.value;
                    setExpiryOption(value === "never" ? "never" : (Number(value) as 30 | 60 | 90));
                  }}
                  aria-label={text("مدة صلاحية الإعلان", "Listing expiry duration")}
                  className="rounded-lg border border-border/70 bg-card px-2 py-1 text-[10px] font-bold text-foreground disabled:opacity-60"
                >
                  <option value="30">{text("30 يوم", "30 days")}</option>
                  <option value="60">{text("60 يوم", "60 days")}</option>
                  <option value="90">{text("90 يوم", "90 days")}</option>
                  <option value="never">{text("بدون انتهاء", "No automatic expiry")}</option>
                </select>
                <button
                  type="button"
                  disabled={lifecycleBusy}
                  onClick={() => void handleExpiryUpdate()}
                  className="rounded-lg bg-emerald-trust/10 px-2 py-1 text-[10px] font-bold text-emerald-trust disabled:opacity-60"
                >
                  {lifecycleBusy
                    ? text("جارٍ التحديث", "Updating")
                    : text("تطبيق / تجديد المدة", "Apply / renew duration")}
                </button>
''',
    "expiry option controls",
)
path.write_text(text, encoding="utf-8")

print("Applied listing expiry options across lifecycle, public visibility, favorites, and owner UI")
