from pathlib import Path

path = Path("src/routes/profile/listings.tsx")
text = path.read_text(encoding="utf-8")
old = '''          {listing.status === "approved" && (
            <p className="rounded-lg bg-emerald-trust/10 p-2 text-[11px] font-semibold text-foreground">
              {listing.renewedAt
                ? `${text("آخر تأكيد للتوفر", "Availability last confirmed")}: ${formatSavedAt(listing.renewedAt, language)}`
                : text(
                    "لم يتم تأكيد استمرار التوفر بعد.",
                    "Availability has not been confirmed yet.",
                  )}
            </p>
          )}
'''
new = '''          {listing.status === "approved" && (
            <p className="rounded-lg bg-emerald-trust/10 p-2 text-[11px] font-semibold text-foreground">
              {listing.renewedAt
                ? `${text("آخر تأكيد للتوفر", "Availability last confirmed")}: ${formatSavedAt(listing.renewedAt, language)}`
                : text(
                    "لم يتم تأكيد استمرار التوفر بعد.",
                    "Availability has not been confirmed yet.",
                  )}
            </p>
          )}
          {listing.expiresAt && (
            <p
              className={`rounded-lg p-2 text-[11px] font-semibold ${
                listing.status === "expired"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-warning/10 text-foreground"
              }`}
            >
              {listing.status === "expired"
                ? text("انتهى الإعلان", "Listing expired")
                : text("موعد انتهاء الإعلان", "Listing expiry")}
              : {formatSavedAt(listing.expiresAt, language)}
            </p>
          )}
'''
count = text.count(old)
if count != 1:
    raise RuntimeError(f"expiry visibility anchor count={count}")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("Applied listing expiry visibility")
