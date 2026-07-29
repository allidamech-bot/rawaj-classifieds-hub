import { Link } from "@tanstack/react-router";
import { FilePenLine, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  discardRecoverableOwnerDraft,
  fetchLatestRecoverableOwnerDraft,
  type RecoverableDraft,
} from "@/lib/classifieds-api";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export function DraftRecoveryBanner() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [draft, setDraft] = useState<RecoverableDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const profileId = auth.profile?.id ?? null;

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) {
      setDraft(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    void fetchLatestRecoverableOwnerDraft(profileId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setDraft(null);
        setError(result.error.message);
        return;
      }
      setDraft(result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [auth.status, profileId]);

  async function handleDiscard() {
    if (!profileId || !draft || deleting) return;
    setDeleting(true);
    setError("");
    const result = await discardRecoverableOwnerDraft(profileId, draft.listing.id);
    setDeleting(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setDraft(null);
  }

  if (auth.status !== "signedIn" || dismissed || (!loading && !draft && !error)) return null;

  return (
    <div className="container-wide pt-3">
      <section className="rounded-[1.25rem] border border-gold/30 bg-card p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold-foreground">
            <FilePenLine className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold">
                  {text("لديك مسودة محفوظة", "You have a saved draft")}
                </h2>
                {draft && (
                  <>
                    <p className="mt-1 line-clamp-1 text-xs font-semibold text-foreground/80">
                      {draft.listing.title || text("إعلان بدون عنوان", "Untitled listing")}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {text("آخر حفظ", "Last saved")}: {formatSavedAt(draft.lastSavedAt, language)}
                    </p>
                  </>
                )}
                {loading && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {text("جاري التحقق من المسودة...", "Checking saved draft...")}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted-surface text-muted-foreground"
                aria-label={text("إغلاق استعادة المسودة", "Close draft recovery")}
                title={text("إغلاق استعادة المسودة", "Close draft recovery")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <p className="mt-3 rounded-xl bg-destructive/10 p-2 text-xs font-semibold text-destructive">
                {error}
              </p>
            )}

            {draft && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to="/profile/listings/$id"
                  params={{ id: draft.listing.id }}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
                >
                  {text("متابعة المسودة", "Resume draft")}
                </Link>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleDiscard()}
                  className="inline-flex items-center gap-1 rounded-xl bg-destructive/10 px-4 py-2 text-xs font-bold text-destructive disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleting ? text("جارٍ الحذف", "Deleting") : text("حذف المسودة", "Delete draft")}
                </button>
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  className="rounded-xl bg-muted-surface px-4 py-2 text-xs font-bold text-foreground hairline"
                >
                  {text("بدء إعلان جديد", "Start new listing")}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function formatSavedAt(value: string, language: "ar" | "en") {
  if (!value) return "";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
