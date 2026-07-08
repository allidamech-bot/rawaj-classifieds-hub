from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one anchor, found {count}")
    return text.replace(old, new, 1)

# Map lifecycle timestamps from Supabase rows.
listings_path = Path("src/lib/api/listings.ts")
listings = listings_path.read_text(encoding="utf-8")
listings = replace_once(
    listings,
    '    archivedAt: rowNullableString(row, "archived_at"),\n    createdAt: rowString(row, "created_at"),',
    '    archivedAt: rowNullableString(row, "archived_at"),\n'
    '    statusChangedAt: rowNullableString(row, "status_changed_at"),\n'
    '    expiresAt: rowNullableString(row, "expires_at"),\n'
    '    renewedAt: rowNullableString(row, "renewed_at"),\n'
    '    createdAt: rowString(row, "created_at"),',
    "map lifecycle timestamps",
)
listings_path.write_text(listings, encoding="utf-8")

# Wire availability confirmation into My Listings.
profile_path = Path("src/routes/profile/listings.tsx")
profile = profile_path.read_text(encoding="utf-8")
profile = replace_once(
    profile,
    '  closeOwnerListing,\n  deleteOwnerListing,',
    '  closeOwnerListing,\n  confirmOwnerListingAvailability,\n  deleteOwnerListing,',
    "availability import",
)
profile = replace_once(
    profile,
    '''  const canEdit =
    listing.status === "draft" ||
    listing.status === "pending_review" ||
    listing.status === "rejected";
''',
    '  const canEdit = listing.status === "draft" || listing.status === "rejected";\n',
    "pending review edit guard",
)
profile = replace_once(
    profile,
    '''  async function handleReactivate() {
    if (lifecycleBusy) return;
    setLifecycleError("");
    setLifecycleBusy(true);
    const result = await reactivateOwnerListing(userId, listing.id);
    setLifecycleBusy(false);
    if (!result.ok) {
      setLifecycleError(result.error.message);
      return;
    }
    onChanged(result.data);
  }

  const lockedMessage = isClosedListingStatus(listing.status)
    ? text(
        "هذا الإعلان مغلق ولا يعدل من هنا. يمكنك إعادة تفعيله للحالات المدعومة.",
        "This listing is closed and cannot be edited here. Supported states can be reactivated.",
      )
    : text(
        "الإعلان المعتمد ظاهر للزوار ولا يعدل من هنا.",
        "Approved listings are public and are not edited here.",
      );
''',
    '''  async function handleReactivate() {
    if (lifecycleBusy) return;
    setLifecycleError("");
    setLifecycleBusy(true);
    const result = await reactivateOwnerListing(userId, listing.id);
    setLifecycleBusy(false);
    if (!result.ok) {
      setLifecycleError(result.error.message);
      return;
    }
    onChanged(result.data);
  }

  async function handleConfirmAvailability() {
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

  const lockedMessage = isClosedListingStatus(listing.status)
    ? text(
        "هذا الإعلان مغلق ولا يعدل من هنا. يمكنك إعادة تفعيله للحالات المدعومة.",
        "This listing is closed and cannot be edited here. Supported states can be reactivated.",
      )
    : listing.status === "pending_review"
      ? text(
          "هذا الإعلان قيد المراجعة ولا يعدل حتى قرار الإدارة.",
          "This listing is under review and cannot be edited until the admin decision.",
        )
      : text(
          "الإعلان المعتمد ظاهر للزوار ولا يعدل من هنا.",
          "Approved listings are public and are not edited here.",
        );
''',
    "confirmation handler and locked message",
)
profile = replace_once(
    profile,
    '''          {listing.status === "draft" && (
            <p className="rounded-lg bg-gold/10 p-2 text-[11px] font-semibold text-primary">
              {text("مسودة محفوظة", "Saved draft")} · {text("آخر حفظ", "Last saved")}{" "}
              {formatSavedAt(listing.updatedAt, language)}
            </p>
          )}
''',
    '''          {listing.status === "draft" && (
            <p className="rounded-lg bg-gold/10 p-2 text-[11px] font-semibold text-primary">
              {text("مسودة محفوظة", "Saved draft")} · {text("آخر حفظ", "Last saved")}{" "}
              {formatSavedAt(listing.updatedAt, language)}
            </p>
          )}
          {listing.status === "approved" && (
            <p className="rounded-lg bg-emerald-trust/10 p-2 text-[11px] font-semibold text-foreground">
              {listing.renewedAt
                ? `${text("آخر تأكيد للتوفر", "Availability last confirmed")}: ${formatSavedAt(listing.renewedAt, language)}`
                : text(
                    "لم يتم تأكيد استمرار التوفر بعد.",
                    "Availability has not been confirmed yet.",
                  )}
            </p>
          )}
''',
    "availability timestamp display",
)
profile = replace_once(
    profile,
    '''            {canClose && (
              <>
                <button
                  type="button"
                  disabled={lifecycleBusy}
                  onClick={() => void handleClose("sold")}
''',
    '''            {canClose && (
              <>
                <button
                  type="button"
                  disabled={lifecycleBusy}
                  onClick={() => void handleConfirmAvailability()}
                  className="rounded-lg bg-emerald-trust/10 px-2 py-1 text-[10px] font-bold text-emerald-trust disabled:opacity-60"
                >
                  {lifecycleBusy
                    ? text("جارٍ التحديث", "Updating")
                    : text("تأكيد استمرار التوفر", "Confirm availability")}
                </button>
                <button
                  type="button"
                  disabled={lifecycleBusy}
                  onClick={() => void handleClose("sold")}
''',
    "availability button",
)
profile_path.write_text(profile, encoding="utf-8")
print("Applied availability confirmation and lifecycle timestamp mapping")
