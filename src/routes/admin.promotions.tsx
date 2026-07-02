import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import {
  adminFetchPromotionRequests,
  adminModeratePromotionRequest,
  createPromotionReceiptSignedUrl,
} from "@/lib/classifieds-api";
import type {
  ClassifiedsError,
  ListingPromotionRequest,
  PromotionType,
} from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/promotions")({
  head: () => ({
    meta: [{ title: "طلبات الترويج | رواج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: PromotionsPage,
});

function PromotionsPage() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const [requests, setRequests] = useState<ListingPromotionRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string | null>>({});
  const [receiptErrors, setReceiptErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [notice, setNotice] = useState("");
  const promotionLabels: Record<PromotionType, string> = {
    featured_home: text("الصفحة الرئيسية", "Home page"),
    highlighted: text("إبراز داخل النتائج", "Highlighted in results"),
    urgent: text("موضع مميز", "Priority placement"),
    top_category: text("أعلى القسم", "Top category"),
  };

  async function load() {
    setLoading(true);
    setError(null);
    const result = await adminFetchPromotionRequests(auth.canAccessAdmin);
    if (result.ok) {
      setRequests(result.data);
      setNotes(Object.fromEntries(result.data.map((item) => [item.id, item.adminNote ?? ""])));
      const signedEntries = await Promise.all(
        result.data.map(async (item) => {
          if (!item.proofPath) return [item.id, null] as const;
          const signed = await createPromotionReceiptSignedUrl(item.proofPath);
          return [item.id, signed.ok ? signed.data : null] as const;
        }),
      );
      setReceiptUrls(Object.fromEntries(signedEntries));
      const errorEntries = await Promise.all(
        result.data.map(async (item) => {
          if (!item.proofPath) return [item.id, ""] as const;
          const signed = await createPromotionReceiptSignedUrl(item.proofPath);
          return [item.id, signed.ok ? "" : signed.error.message] as const;
        }),
      );
      setReceiptErrors(Object.fromEntries(errorEntries));
    } else {
      setRequests([]);
      setReceiptUrls({});
      setReceiptErrors({});
      setError(result.error);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [auth.canAccessAdmin]);

  async function moderate(request: ListingPromotionRequest, status: "approved" | "rejected") {
    setNotice("");
    const result = await adminModeratePromotionRequest(auth.canAccessAdmin, {
      requestId: request.id,
      status,
      adminNote: notes[request.id] ?? null,
    });
    if (result.ok) {
      setNotice(
        status === "approved"
          ? text("تم اعتماد الترويج.", "Promotion approved.")
          : text("تم رفض الترويج.", "Promotion rejected."),
      );
      await load();
    } else {
      setNotice(result.error.message);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-card p-4 hairline">
        <h2 className="flex items-center gap-2 text-base font-extrabold">
          <Sparkles className="h-4 w-4 text-gold" />
          {text("طلبات الترويج", "Promotion requests")}
        </h2>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          {text(
            "الموافقة تجعل الإعلان مميزاً لمدة الطلب عبر trigger قاعدة البيانات. لا توجد معالجة دفع في هذا السبرنت.",
            "Approval marks the listing featured for the requested period through the database trigger. No payment processing is implemented in this sprint.",
          )}
        </p>
        {notice && (
          <p className="mt-3 rounded-xl bg-muted-surface p-2 text-xs font-semibold">{notice}</p>
        )}
      </section>

      {loading ? (
        <Panel title={text("جارٍ تحميل طلبات الترويج", "Loading promotion requests")} />
      ) : error ? (
        <Panel
          title={text("تعذر تحميل طلبات الترويج", "Could not load promotion requests")}
          body={error.message}
        />
      ) : requests.length === 0 ? (
        <Panel title={text("لا توجد طلبات ترويج حالياً", "No promotion requests right now")} />
      ) : (
        <div className="grid gap-3">
          {requests.map((request) => (
            <article key={request.id} className="rounded-2xl bg-card p-4 hairline">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold">
                    {request.listingTitle ?? request.listingId}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {promotionLabels[request.promotionType]} · {request.requestedDays}{" "}
                    {text("يوم", "days")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{request.requesterUserId}</p>
                  {(request.paymentMethod || request.paymentReference) && (
                    <p className="mt-1 text-xs">
                      {request.paymentMethod ?? ""} {request.paymentReference ?? ""}
                    </p>
                  )}
                  <div className="mt-2 text-xs">
                    {request.proofPath ? (
                      receiptUrls[request.id] ? (
                        <a
                          href={receiptUrls[request.id] ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-muted-surface px-2 py-1 font-bold text-primary hairline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {text("عرض الإيصال", "View receipt")}
                        </a>
                      ) : (
                        <span className="rounded-lg bg-muted-surface px-2 py-1 font-bold text-muted-foreground hairline">
                          {receiptErrors[request.id]
                            ? text(
                                "تعذر تحميل الإيصال. تحقق من إعدادات التخزين أو الصلاحيات.",
                                "Could not load receipt. Check storage settings or permissions.",
                              )
                            : text(
                                "إيصال مرفوع - رابط العرض غير متاح",
                                "Receipt uploaded - view link unavailable",
                              )}
                        </span>
                      )
                    ) : (
                      <span className="rounded-lg bg-muted-surface px-2 py-1 font-bold text-muted-foreground hairline">
                        {text("لا يوجد إيصال", "No receipt")}
                      </span>
                    )}
                  </div>
                </div>
                <span className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold hairline">
                  {request.status}
                </span>
              </div>
              <textarea
                value={notes[request.id] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({ ...current, [request.id]: event.target.value }))
                }
                rows={2}
                placeholder={text("ملاحظة إدارية", "Admin note")}
                className="mt-3 w-full rounded-xl bg-muted-surface px-3 py-2 text-xs outline-none hairline"
              />
              {request.status === "pending_review" && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => void moderate(request, "approved")}
                    className="rounded-xl bg-emerald-trust px-3 py-2 text-xs font-bold text-emerald-trust-foreground"
                  >
                    {text("موافقة", "Approve")}
                  </button>
                  <button
                    onClick={() => void moderate(request, "rejected")}
                    className="rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground"
                  >
                    {text("رفض", "Reject")}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Panel({ title, body }: { title: string; body?: string }) {
  return (
    <section className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
    </section>
  );
}
