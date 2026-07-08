from pathlib import Path

path = Path("src/routes/profile/listings.$id.tsx")
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one anchor, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    '''            <Link
              to="/listings/$id"
              params={{ id: listing.id }}
              className="rawaj-chip px-3 py-2 font-semibold text-primary transition hover:border-gold/40"
            >
              {text("عرض العام", "View public")}
            </Link>
''',
    '''            {listing.status === "approved" && (
              <Link
                to="/listings/$id"
                params={{ id: listing.id }}
                className="rawaj-chip px-3 py-2 font-semibold text-primary transition hover:border-gold/40"
              >
                {text("عرض العام", "View public")}
              </Link>
            )}
''',
    "approved-only public link",
)

replace_once(
    '''        {isPendingReview && (
          <div className="mb-4">
            <ListingStudioMessage tone="warning">
              {text(
                "هذا الإعلان قيد المراجعة ولا يمكن تعديله حتى قرار الإدارة. يمكنك حذفه فقط أو إعادة إرساله بعد الرفض.",
                "This listing is under review and cannot be edited until the admin decision. You can only delete it or resubmit it if rejected.",
              )}
            </ListingStudioMessage>
          </div>
        )}

        {listing.rejectionReason && (
''',
    '''        {isPendingReview && (
          <div className="mb-4">
            <ListingStudioMessage tone="warning">
              {text(
                "هذا الإعلان قيد المراجعة ولا يمكن تعديله الآن. بعد قرار الإدارة سيظهر للعامة عند الموافقة، أو يمكنك تعديل سبب الرفض ثم إعادة إرساله إذا رُفض.",
                "This listing is under review and cannot be edited now. After the admin decision it will become public if approved, or you can address the rejection and resubmit if rejected.",
              )}
            </ListingStudioMessage>
          </div>
        )}

        {listing.status === "draft" && (
          <div className="mb-4">
            <ListingStudioMessage tone="warning">
              {text(
                "حفظ التعديلات يبقي الإعلان كمسودة خاصة ولا يرسله للمراجعة. عند اكتمال المعلومات اضغط «إعادة إرسال للمراجعة»؛ بعدها يتوقف التعديل حتى قرار الإدارة.",
                "Saving changes keeps this listing as a private draft and does not submit it for review. When ready, choose “Resubmit for review”; editing then pauses until the admin decision.",
              )}
            </ListingStudioMessage>
          </div>
        )}

        {listing.status === "rejected" && (
          <div className="mb-4">
            <ListingStudioMessage tone="warning">
              {text(
                "تعديل الإعلان المرفوض لا يعيده تلقائياً للمراجعة. أصلح سبب الرفض، احفظ تعديلاتك عند الحاجة، ثم اضغط «إعادة إرسال للمراجعة» عندما يصبح جاهزاً.",
                "Editing a rejected listing does not automatically resubmit it. Fix the rejection reason, save changes as needed, then choose “Resubmit for review” when ready.",
              )}
            </ListingStudioMessage>
          </div>
        )}

        {listing.rejectionReason && (
''',
    "status impact guidance",
)

replace_once(
    '''                {isEditable && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSave}
                    className="w-full rounded-[1rem] bg-emerald-trust px-3 py-3 text-xs font-semibold text-emerald-trust-foreground shadow-soft transition hover:brightness-[0.98] disabled:opacity-50"
                  >
                    {saving
                      ? text("جارٍ الحفظ...", "Saving...")
                      : text("حفظ التعديلات", "Save changes")}
                  </button>
                )}
                {isResubmittable && (
                  <button
                    type="button"
                    disabled={resubmitting}
                    onClick={handleResubmit}
                    className="rawaj-button-primary w-full rounded-[1rem] px-3 py-3 disabled:opacity-50"
                  >
                    {resubmitting
                      ? text("جارٍ الإرسال...", "Submitting...")
                      : text("إعادة إرسال للمراجعة", "Resubmit for review")}
                  </button>
                )}
''',
    '''                {isEditable && (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleSave}
                      className="w-full rounded-[1rem] bg-emerald-trust px-3 py-3 text-xs font-semibold text-emerald-trust-foreground shadow-soft transition hover:brightness-[0.98] disabled:opacity-50"
                    >
                      {saving
                        ? text("جارٍ الحفظ...", "Saving...")
                        : text("حفظ التعديلات", "Save changes")}
                    </button>
                    <p className="px-1 text-[10px] leading-4 text-muted-foreground">
                      {text(
                        "يحفظ فقط؛ لا يرسل الإعلان للمراجعة.",
                        "Saves only; does not submit the listing for review.",
                      )}
                    </p>
                  </div>
                )}
                {isResubmittable && (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      disabled={resubmitting}
                      onClick={handleResubmit}
                      className="rawaj-button-primary w-full rounded-[1rem] px-3 py-3 disabled:opacity-50"
                    >
                      {resubmitting
                        ? text("جارٍ الإرسال...", "Submitting...")
                        : text("إعادة إرسال للمراجعة", "Resubmit for review")}
                    </button>
                    <p className="px-1 text-[10px] leading-4 text-muted-foreground">
                      {text(
                        "ينقل الإعلان إلى قيد المراجعة ويوقف التعديل حتى القرار.",
                        "Moves the listing into review and pauses editing until a decision.",
                      )}
                    </p>
                  </div>
                )}
''',
    "action impact descriptions",
)

path.write_text(text, encoding="utf-8")
print("Applied listing edit impact clarity")
