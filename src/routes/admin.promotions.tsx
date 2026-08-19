import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ExternalLink,
  FileQuestion,
  FileText,
  ImageIcon,
  Package,
  Rocket,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  adminFetchPromotionRequests,
  adminModeratePromotionRequest,
  createPromotionReceiptSignedUrl,
} from "@/lib/classifieds-api";
import type { ClassifiedsError, ListingPromotionRequest } from "@/lib/classifieds-types";
import {
  formatSearchBoostPrice,
  searchBoostDurationLabel,
  searchBoostName,
  searchBoostPackageFromPromotion,
} from "@/lib/search-boost-growth";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/promotions")({
  head: () => ({
    meta: [
      { title: "الترويج و Search Boost | رواج" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PromotionsPage,
});

function PromotionsPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
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
  const receiptUrlsRef = useRef<Record<string, string | null>>({});
  receiptUrlsRef.current = receiptUrls;

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
      ...Object.fromEntries(result.data.map((item) => [item.id, current[item.id] ?? ""])),
    }));
    setHasLoaded(true);
  }, [canManagePromotions]);

  useEffect(() => {
    loadRequestIdRef.current += 1;
    setRequests([]);
    setHasLoaded(false);
    setLoadError(null);
    setReceiptErrors({});
    void load();
    return () => {
      loadRequestIdRef.current += 1;
      receiptInFlightRef.current.clear();
      actionInFlightRef.current.clear();
      for (const url of Object.values(receiptUrlsRef.current)) {
        if (url) URL.revokeObjectURL(url);
      }
    };
  }, [load]);

  async function loadReceipt(request: ListingPromotionRequest) {
    if (!request.proofPath || receiptInFlightRef.current.has(request.id)) return;
    receiptInFlightRef.current.add(request.id);
    setReceiptLoadingId(request.id);
    setReceiptErrors((current) => ({ ...current, [request.id]: "" }));
    try {
      const result = await createPromotionReceiptSignedUrl(request.proofPath);
      if (!result.ok || !result.data) {
        setReceiptErrors((current) => ({
          ...current,
          [request.id]: result.ok
            ? text("الإيصال غير متاح أو تم حذفه.", "Receipt is unavailable or was deleted.")
            : result.error.message,
        }));
        return;
      }
      setReceiptUrls((current) => ({ ...current, [request.id]: result.data }));
    } finally {
      receiptInFlightRef.current.delete(request.id);
      setReceiptLoadingId((current) => (current === request.id ? null : current));
    }
  }

  async function moderate(request: ListingPromotionRequest, status: "approved" | "rejected") {
    if (actionInFlightRef.current.has(request.id) || request.status !== "pending_review") return;
    const note = notes[request.id]?.trim() ?? "";
    if (status === "rejected" && !note) {
      setActionMessage(text("سبب الرفض مطلوب.", "A rejection reason is required."));
      return;
    }

    const boostPackage = searchBoostPackageFromPromotion(request);
    actionInFlightRef.current.add(request.id);
    setWorkingRequestId(request.id);
    setActionMessage("");
    try {
      const result = await adminModeratePromotionRequest(canManagePromotions, {
        requestId: request.id,
        status,
        adminNote: note || null,
        expectedUpdatedAt: request.updatedAt,
      });
      if (!result.ok) {
        setActionMessage(result.error.message);
        return;
      }
      setActionMessage(
        boostPackage
          ? status === "approved"
            ? text(
                "تم اعتماد Search Boost وبدأت المدة المشتراة.",
                "Search Boost approved; the purchased duration has started.",
              )
            : text(
                "تم رفض الطلب من دون تفعيل Boost.",
                "Request rejected without activating Boost.",
              )
          : status === "approved"
            ? text("تم اعتماد طلب الترويج.", "Promotion request approved.")
            : text("تم رفض طلب الترويج.", "Promotion request rejected."),
      );
      await load();
    } finally {
      actionInFlightRef.current.delete(request.id);
      setWorkingRequestId((current) => (current === request.id ? null : current));
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-card p-4 hairline sm:p-5">
        <h1 className="flex items-center gap-2 text-lg font-black">
          <Rocket className="h-5 w-5 text-amber-700" />
          {text("الترويج و Search Boost", "Promotions & Search Boost")}
        </h1>
        <p className="mt-2 max-w-3xl text-xs leading-6 text-muted-foreground">
          {text(
            "راجع طلبات Boost وطلبات المساحة الرئيسية ونتائج البحث والأقسام والحملات من نفس قائمة الإدارة. Boost يبدأ بعد اعتماد الدفع، أما الترويج المخصص فيُراجع حسب تفاصيل الطلب.",
            "Review Boost plus homepage, search-results, category, and campaign requests in one admin queue. Boost starts after payment approval; custom promotion follows its request details.",
          )}
        </p>
        {actionMessage ? (
          <p
            role="status"
            className="mt-3 rounded-xl bg-muted-surface p-3 text-xs font-semibold"
          >
            {actionMessage}
          </p>
        ) : null}
      </section>

      {loading && !hasLoaded ? (
        <Panel title={text("جارٍ تحميل طلبات الترويج", "Loading promotion requests")} />
      ) : loadError && !hasLoaded ? (
        <Panel
          title={text("تعذر تحميل الطلبات", "Could not load requests")}
          body={loadError.message}
          actionLabel={text("إعادة المحاولة", "Try again")}
          onAction={() => void load()}
        />
      ) : requests.length === 0 ? (
        <Panel title={text("لا توجد طلبات ترويج حالياً", "No promotion requests right now")} />
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => {
            const boostPackage = searchBoostPackageFromPromotion(request);
            const receiptUrl = receiptUrls[request.id];
            const receiptType = request.proofContentType ?? "";
            const receiptIsImage = receiptType.startsWith("image/");
            const receiptIsPdf = receiptType === "application/pdf";
            return (
              <article key={request.id} className="rounded-2xl bg-card p-4 hairline sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-black">
                      {request.listingTitle ?? request.listingId}
                    </h2>
                    <p className="mt-1 break-all text-[10px] text-muted-foreground">
                      ID: {request.listingId}
                    </p>
                  </div>
                  <StatusBadge status={request.status} text={text} />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <InfoBlock
                    icon={<Package />}
                    label={
                      boostPackage
                        ? text("الباقة", "Package")
                        : text("نوع الترويج", "Promotion type")
                    }
                  >
                    <p className="font-black">
                      {boostPackage
                        ? searchBoostName(boostPackage.code, text)
                        : promotionTypeLabel(request.promotionType, text)}
                    </p>
                    <p>
                      {boostPackage
                        ? searchBoostDurationLabel(boostPackage.code, text)
                        : `${request.requestedDays} ${text("يوم", "days")}`}
                    </p>
                    {boostPackage ? (
                      <p className="font-bold text-amber-800 dark:text-amber-300">
                        {request.searchBoostPriceSyp != null
                          ? formatSearchBoostPrice(request.searchBoostPriceSyp, language)
                          : text("المبلغ غير متاح", "Amount unavailable")}
                      </p>
                    ) : (
                      <p className="font-bold text-fuchsia-700 dark:text-fuchsia-300">
                        {text("السعر يُحدد عند المراجعة", "Pricing confirmed on review")}
                      </p>
                    )}
                  </InfoBlock>
                  <InfoBlock icon={<UserRound />} label={text("العميل", "Customer")}>
                    <p className="font-bold">
                      {request.requesterDisplayName ?? text("حساب رواج", "RAWAJ account")}
                    </p>
                    <p className="break-all text-[10px]">{request.requesterUserId}</p>
                  </InfoBlock>
                  <InfoBlock label={text("الدفع", "Payment")}>
                    <p>
                      {request.paymentMethod || text("لم تُذكر الطريقة", "Method not provided")}
                    </p>
                    <p className="break-words">
                      {request.paymentReference || text("لا يوجد مرجع", "No reference")}
                    </p>
                  </InfoBlock>
                  <InfoBlock label={text("التوقيت والمراجعة", "Timing & review")}>
                    <p>
                      {text("أُنشئ", "Created")}: {formatDate(request.createdAt, language)}
                    </p>
                    <p>
                      {request.reviewedAt
                        ? `${text("رُوجع", "Reviewed")}: ${formatDate(request.reviewedAt, language)}`
                        : text("لم يُراجع بعد", "Not reviewed yet")}
                    </p>
                    {request.reviewedBy ? (
                      <p className="break-all text-[10px]">{request.reviewedBy}</p>
                    ) : null}
                  </InfoBlock>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to="/listings/$id"
                    params={{ id: request.listingId }}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold hairline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {text("فتح الإعلان", "Open listing")}
                  </Link>
                  <Link
                    to="/seller/$id"
                    params={{ id: request.requesterUserId }}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold hairline"
                  >
                    <UserRound className="h-3.5 w-3.5" />
                    {text("فتح حساب العميل", "Open customer")}
                  </Link>
                </div>

                <section
                  className="mt-4 rounded-xl bg-muted-surface p-3 hairline"
                  aria-label={text("إيصال الدفع", "Payment receipt")}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-black">
                      {receiptIsImage ? (
                        <ImageIcon className="h-4 w-4" />
                      ) : receiptIsPdf ? (
                        <FileText className="h-4 w-4" />
                      ) : (
                        <FileQuestion className="h-4 w-4" />
                      )}
                      {receiptIsImage
                        ? text("إيصال صورة خاص", "Private image receipt")
                        : receiptIsPdf
                          ? text("إيصال PDF خاص", "Private PDF receipt")
                          : request.proofPath
                            ? text("ملف إثبات خاص", "Private proof file")
                            : text("لا يوجد إثبات مرفوع", "No proof uploaded")}
                    </div>
                    {request.proofPath && !receiptUrl ? (
                      <button
                        type="button"
                        disabled={receiptLoadingId === request.id}
                        onClick={() => void loadReceipt(request)}
                        className="min-h-10 rounded-xl bg-card px-3 py-2 text-xs font-bold hairline disabled:opacity-60"
                      >
                        {receiptLoadingId === request.id
                          ? text("جارٍ التحميل", "Loading")
                          : receiptErrors[request.id]
                            ? text("إعادة محاولة التحميل", "Retry loading")
                            : text("تحميل آمن", "Load securely")}
                      </button>
                    ) : null}
                  </div>
                  {receiptErrors[request.id] ? (
                    <p role="alert" className="mt-2 text-xs font-semibold text-destructive">
                      {receiptErrors[request.id]}
                    </p>
                  ) : null}
                  {receiptUrl && receiptIsImage ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,18rem)_auto] sm:items-end">
                      <img
                        src={receiptUrl}
                        alt={text("معاينة إيصال الدفع", "Payment receipt preview")}
                        className="max-h-64 w-full rounded-xl bg-card object-contain hairline"
                      />
                      <SecureOpenLink url={receiptUrl} text={text} />
                    </div>
                  ) : receiptUrl ? (
                    <div className="mt-3">
                      <SecureOpenLink url={receiptUrl} text={text} />
                    </div>
                  ) : null}
                </section>

                <label className="mt-4 block">
                  <span className="text-xs font-bold text-muted-foreground">
                    {text(
                      "ملاحظة الإدارة / سبب الرفض",
                      "Admin note / rejection reason",
                    )}
                  </span>
                  <textarea
                    value={notes[request.id] ?? ""}
                    disabled={
                      workingRequestId === request.id || request.status !== "pending_review"
                    }
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [request.id]: event.target.value,
                      }))
                    }
                    rows={3}
                    maxLength={1000}
                    className="mt-1.5 w-full rounded-xl bg-muted-surface px-3 py-2 text-sm outline-none hairline focus:ring-2 focus:ring-primary disabled:opacity-70"
                  />
                </label>
                {request.adminNote && request.status !== "pending_review" ? (
                  <p className="mt-3 rounded-xl bg-muted-surface p-3 text-xs leading-6 text-muted-foreground">
                    {request.adminNote}
                  </p>
                ) : null}

                {request.status === "pending_review" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={workingRequestId === request.id}
                      onClick={() => void moderate(request, "approved")}
                      className="min-h-11 rounded-xl bg-emerald-trust px-4 py-2 text-xs font-black text-emerald-trust-foreground disabled:opacity-60"
                    >
                      {workingRequestId === request.id
                        ? text("جارٍ التحديث", "Updating")
                        : boostPackage
                          ? text("اعتماد وتفعيل المدة", "Approve & activate")
                          : text("اعتماد الطلب", "Approve request")}
                    </button>
                    <button
                      type="button"
                      disabled={workingRequestId === request.id || !notes[request.id]?.trim()}
                      onClick={() => void moderate(request, "rejected")}
                      className="min-h-11 rounded-xl bg-destructive px-4 py-2 text-xs font-black text-destructive-foreground disabled:opacity-50"
                    >
                      {boostPackage
                        ? text("رفض مع السبب", "Reject with reason")
                        : text("رفض طلب الترويج", "Reject promotion request")}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
      {loadError && hasLoaded ? (
        <Panel
          title={text("تعذر تحديث الطلبات", "Could not refresh requests")}
          body={loadError.message}
          actionLabel={text("إعادة المحاولة", "Try again")}
          onAction={() => void load()}
        />
      ) : null}
    </div>
  );
}

function InfoBlock({
  icon,
  label,
  children,
}: {
  icon?: React.ReactElement;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-muted-surface p-3 text-xs leading-6 hairline">
      <p className="flex items-center gap-2 text-[10px] font-extrabold text-muted-foreground">
        {icon ? <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span> : null}
        {label}
      </p>
      <div className="mt-1 min-w-0">{children}</div>
    </div>
  );
}

function SecureOpenLink({
  url,
  text,
}: {
  url: string;
  text: (ar: string, en: string) => string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-card px-3 py-2 text-xs font-bold text-primary hairline"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      {text("فتح بالحجم الكامل", "Open full size")}
    </a>
  );
}

function StatusBadge({
  status,
  text,
}: {
  status: ListingPromotionRequest["status"];
  text: (ar: string, en: string) => string;
}) {
  const label =
    status === "approved"
      ? text("نشط / معتمد", "Active / approved")
      : status === "rejected"
        ? text("مرفوض", "Rejected")
        : status === "expired"
          ? text("منتهي", "Expired")
          : status === "cancelled"
            ? text("ملغي", "Cancelled")
            : text("بانتظار المراجعة", "Pending review");
  return (
    <span className="rounded-full bg-muted-surface px-3 py-1 text-[10px] font-black hairline">
      {label}
    </span>
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
      <p className="text-sm font-bold">{title}</p>
      {body ? <p className="mt-1 text-xs text-muted-foreground">{body}</p> : null}
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

function promotionTypeLabel(
  type: ListingPromotionRequest["promotionType"],
  text: (ar: string, en: string) => string,
) {
  if (type === "highlighted") return text("نتائج البحث", "Search results");
  if (type === "top_category") return text("الأقسام", "Categories");
  if (type === "urgent") return text("حملة إعلانية", "Advertising campaign");
  return text("مساحة رئيسية", "Homepage placement");
}

function formatDate(value: string, language: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(language === "en" ? "en-US" : "ar-SY", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
