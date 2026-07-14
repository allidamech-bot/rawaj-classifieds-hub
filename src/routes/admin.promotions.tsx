import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const canManagePromotions = auth.hasPermission("canManagePromotions");
  const [requests, setRequests] = useState<ListingPromotionRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string | null>>({});
  const [receiptErrors, setReceiptErrors] = useState<Record<string, string>>({});
  const [receiptLoadingId, setReceiptLoadingId] = useState<string | null>(null);
  const [workingRequestId, setWorkingRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<ClassifiedsError | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const loadRequestIdRef = useRef(0);
  const receiptInFlightRef = useRef<Set<string>>(new Set());
  const actionInFlightRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setLoadError(null);
    const result = await adminFetchPromotionRequests(canManagePromotions);
    if (requestId !== loadRequestIdRef.current) return;
    setLoading(false);
    if (!result.ok) {
      setLoadError(result.error);
      return;
    }
    setRequests(result.data);
    setNotes((current) => ({
      ...current,
      ...Object.fromEntries(
        result.data.map((item) => [item.id, current[item.id] ?? item.adminNote ?? ""]),
      ),
    }));
    setHasLoaded(true);
  }, [canManagePromotions]);

  useEffect(() => {
    loadRequestIdRef.current += 1;
    setRequests([]);
    setHasLoaded(false);
    setLoadError(null);
    setReceiptUrls({});
    setReceiptErrors({});
    void load();
    return () => {
      loadRequestIdRef.current += 1;
      receiptInFlightRef.current.clear();
      actionInFlightRef.current.clear();
    };
  }, [load]);

  async function loadReceipt(request: ListingPromotionRequest) {
    if (!request.proofPath || receiptInFlightRef.current.has(request.id)) return;
    receiptInFlightRef.current.add(request.id);
    setReceiptLoadingId(request.id);
    setReceiptErrors((current) => ({ ...current, [request.id]: "" }));
    try {
      const result = await createPromotionReceiptSignedUrl(request.proofPath);
      if (!result.ok) {
        setReceiptErrors((current) => ({ ...current, [request.id]: result.error.message }));
        return;
      }
      setReceiptUrls((current) => ({ ...current, [request.id]: result.data }));
    } finally {
      receiptInFlightRef.current.delete(request.id);
      setReceiptLoadingId((current) => (current === request.id ? null : current));
    }
  }

  async function moderate(request: ListingPromotionRequest, status: "approved" | "rejected") {
    if (actionInFlightRef.current.has(request.id)) return;
    actionInFlightRef.current.add(request.id);
    setWorkingRequestId(request.id);
    setActionMessage("");
    try {
      const result = await adminModeratePromotionRequest(canManagePromotions, {
        requestId: request.id,
        status,
        adminNote: notes[request.id] ?? null,
        expectedUpdatedAt: request.updatedAt,
      });
      if (!result.ok) {
        setActionMessage(result.error.message);
        return;
      }
      setRequests((current) =>
        current.map((item) => (item.id === request.id ? { ...item, status } : item)),
      );
      setActionMessage(
        status === "approved"
          ? text("تم اعتماد الترويج.", "Promotion approved.")
          : text("تم رفض الترويج.", "Promotion rejected."),
      );
      await load();
    } finally {
      actionInFlightRef.current.delete(request.id);
      setWorkingRequestId((current) => (current === request.id ? null : current));
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
            "الموافقة تجعل الإعلان مميزاً لمدة الطلب بعد المراجعة اليدوية. راجع الملاحظات والإيصالات قبل اتخاذ القرار.",
            "Approval marks the listing featured for the requested period after manual review. Review notes and receipts before deciding.",
          )}
        </p>
        {actionMessage && (
          <p className="mt-3 rounded-xl bg-muted-surface p-2 text-xs font-semibold">
            {actionMessage}
          </p>
        )}
      </section>

      {loadError && hasLoaded ? (
        <Panel
          title={text("تعذر تحديث طلبات الترويج", "Could not refresh promotion requests")}
          body={loadError.message}
          actionLabel={text("إعادة المحاولة", "Try again")}
          onAction={() => void load()}
        />
      ) : null}

      {loading && !hasLoaded ? (
        <Panel title={text("جارٍ تحميل طلبات الترويج", "Loading promotion requests")} />
      ) : loadError && !hasLoaded ? (
        <Panel
          title={text("تعذر تحميل طلبات الترويج", "Could not load promotion requests")}
          body={loadError.message}
          actionLabel={text("إعادة المحاولة", "Try again")}
          onAction={() => void load()}
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
                    {promotionTypeLabel(request.promotionType, text)} · {request.requestedDays}{" "}
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
                        <button
                          type="button"
                          disabled={receiptLoadingId === request.id}
                          onClick={() => void loadReceipt(request)}
                          className="rounded-lg bg-muted-surface px-2 py-1 font-bold text-muted-foreground hairline disabled:opacity-60"
                        >
                          {receiptLoadingId === request.id
                            ? text("جارٍ إنشاء رابط الإيصال", "Creating receipt link")
                            : receiptErrors[request.id]
                              ? text("إعادة محاولة فتح الإيصال", "Retry receipt")
                              : text("فتح الإيصال بأمان", "Open receipt securely")}
                        </button>
                      )
                    ) : (
                      <span className="rounded-lg bg-muted-surface px-2 py-1 font-bold text-muted-foreground hairline">
                        {text("لا يوجد إيصال", "No receipt")}
                      </span>
                    )}
                  </div>
                </div>
                <span className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold hairline">
                  {promotionStatusLabel(request.status, text)}
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

function Panel({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>{" "}
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

function promotionStatusLabel(
  status: ListingPromotionRequest["status"],
  text: (ar: string, en: string) => string,
) {
  if (status === "approved") return text("معتمد", "Approved");
  if (status === "rejected") return text("مرفوض", "Rejected");
  if (status === "expired") return text("منتهي", "Expired");
  if (status === "cancelled") return text("ملغي", "Cancelled");
  return text("قيد المراجعة", "Pending review");
}

function promotionTypeLabel(type: PromotionType, text: (ar: string, en: string) => string) {
  if (type === "top_category") return text("أعلى القسم", "Top category");
  if (type === "highlighted") return text("إبراز داخل النتائج", "Highlighted in results");
  if (type === "urgent") return text("موضع مميز", "Priority placement");
  return text("الصفحة الرئيسية", "Home page");
}
