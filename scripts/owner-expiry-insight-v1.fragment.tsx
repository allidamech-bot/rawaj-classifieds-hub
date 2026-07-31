{expiryInsight ? (
  <div
    data-owner-expiry-insight={expiryInsight.tone}
    className={
      "rounded-xl border p-2.5 " + ownerExpiryInsightClassName(expiryInsight.tone)
    }
  >
    <p className="flex items-center gap-1.5 text-[11px] font-extrabold">
      <Clock3 className="h-3.5 w-3.5" />
      {expiryInsight.title}
    </p>
    <p className="mt-1 text-[10px] leading-4 opacity-80">
      {expiryInsight.description}
      {listing.expiresAt
        ? " · " +
          text("التاريخ", "Date") +
          ": " +
          formatSavedAt(listing.expiresAt, language)
        : ""}
    </p>
  </div>
) : null}