import { createFileRoute } from "@tanstack/react-router";
import { Clock, FileCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { adminFetchPendingListings, adminModerateListing } from "@/lib/classifieds-api";
import type { ClassifiedListing, ClassifiedsError } from "@/lib/classifieds-types";
import { categoryName, governorateName, uiLabel } from "@/lib/i18n";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/pending")({
  component: PendingPage,
});

function PendingPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [message, setMessage] = useState("");
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  async function loadPending() {
    setLoading(true);
    setError(null);
    const result = await adminFetchPendingListings(auth.canAccessOwnerControls);
    if (result.ok) setListings(result.data);
    else {
      setError(result.error);
      setListings([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadPending();
  }, [auth.canAccessOwnerControls]);

  async function moderate(listing: ClassifiedListing, status: "approved" | "rejected") {
    setMessage("");
    if (!auth.profile?.id) {
      setMessage(
        text("تعذر تحديد حساب المراجع الحالي.", "Could not identify the current reviewer account."),
      );
      return;
    }
    const result = await adminModerateListing(auth.canAccessOwnerControls, {
      listingId: listing.id,
      status,
      reviewerId: auth.profile.id,
      rejectionReason:
        status === "rejected" ? rejectReasons[listing.id] || "مرفوض من لوحة المالك" : null,
    });
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    setMessage(
      status === "approved"
        ? text("تم اعتماد الإعلان.", "Listing approved.")
        : text("تم رفض الإعلان.", "Listing rejected."),
    );
    await loadPending();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-card p-4 hairline">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold">
              <FileCheck className="h-4 w-4 text-primary" />
              {text("إعلانات قيد المراجعة", "Listings pending review")}
            </h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              {text(
                "يعرض هذا الطابور الإعلانات الحقيقية التي تنتظر قرار المالك.",
                "This queue shows real listings waiting for an owner decision.",
              )}
            </p>
          </div>
          <Badge>{text("محمي بالصلاحيات", "Permission protected")}</Badge>
        </div>
        {message && (
          <p className="mt-3 rounded-xl bg-muted-surface p-2 text-xs font-semibold">{message}</p>
        )}
      </section>

      {loading ? (
        <Panel title={text("جارٍ تحميل طابور المراجعة", "Loading review queue")} />
      ) : error ? (
        <Panel
          title={text("تعذر تحميل طابور المراجعة", "Could not load review queue")}
          body={error.message}
        />
      ) : listings.length === 0 ? (
        <Panel
          title={text("لا توجد إعلانات بانتظار المراجعة", "No listings awaiting review")}
          body={text(
            "عند إرسال إعلانات جديدة للمراجعة ستظهر هنا.",
            "New submitted listings will appear here.",
          )}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {listings.map((listing) => (
            <article key={listing.id} className="rounded-2xl bg-card p-4 hairline">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold">{listing.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {listing.id} ·{" "}
                    {categoryName(
                      listing.categoryId,
                      listing.categoryNameAr ?? undefined,
                      language,
                    )}{" "}
                    ·{" "}
                    {governorateName(
                      listing.governorateId,
                      listing.governorateNameAr ?? undefined,
                      language,
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {text("صاحب الإعلان:", "Listing owner:")} {listing.ownerId} ·{" "}
                    {text("الإرسال:", "Submitted:")} {formatDate(listing.createdAt, language)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-1 text-[10px] font-bold text-warning">
                  <Clock className="h-3 w-3" />
                  {uiLabel(listing.status, language)}
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  value={rejectReasons[listing.id] ?? ""}
                  onChange={(event) =>
                    setRejectReasons((current) => ({
                      ...current,
                      [listing.id]: event.target.value,
                    }))
                  }
                  placeholder={text("سبب الرفض عند الحاجة", "Rejection reason when needed")}
                  className="rounded-xl bg-muted-surface px-3 py-2 text-xs outline-none hairline"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => void moderate(listing, "approved")}
                    className="rounded-xl bg-emerald-trust px-3 py-2 text-xs font-bold text-emerald-trust-foreground"
                  >
                    {text("اعتماد", "Approve")}
                  </button>
                  <button
                    onClick={() => void moderate(listing, "rejected")}
                    className="rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground"
                  >
                    {text("رفض", "Reject")}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Panel({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
      {children}
    </span>
  );
}

function formatDate(value: string, language: Language) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}
