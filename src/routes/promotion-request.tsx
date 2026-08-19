import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Clock3,
  FileUp,
  Home,
  LayoutGrid,
  LifeBuoy,
  Megaphone,
  Rocket,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  createListingPromotionRequest,
  fetchCurrentUserListings,
  fetchMyPromotionRequests,
  uploadPromotionReceipt,
} from "@/lib/classifieds-api";
import type {
  ClassifiedListing,
  ListingPromotionRequest,
  PromotionType,
} from "@/lib/classifieds-types";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

const DURATION_OPTIONS = [3, 7, 14, 30] as const;

export const Route = createFileRoute("/promotion-request")({
  head: () =>
    createSeo({
      title: "طلب ترويج | RAWAJ / رواج",
      description:
        "اطلب مساحة ترويجية أو ظهوراً إضافياً لإعلانك المعتمد على رواج سوريا مع مراجعة الإدارة قبل التفعيل.",
      path: "/promotion-request",
      noindex: true,
    }),
  component: PromotionRequestPage,
});

function PromotionRequestPage() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const profileId = auth.profile?.id ?? null;
  const requestIdRef = useRef(0);
  const submitInFlightRef = useRef(false);
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [requests, setRequests] = useState<ListingPromotionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [selectedListingId, setSelectedListingId] = useState("");
  const [promotionType, setPromotionType] = useState<PromotionType>("featured_home");
  const [requestedDays, setRequestedDays] = useState<number>(7);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const approvedListings = useMemo(
    () => listings.filter((listing) => listing.status === "approved"),
    [listings],
  );
  const customRequests = useMemo(
    () => requests.filter((request) => !request.searchBoostPackageCode),
    [requests],
  );
  const hasPendingForSelectedListing = requests.some(
    (request) => request.listingId === selectedListingId && request.status === "pending_review",
  );

  const promotionOptions: Array<{
    value: PromotionType;
    label: string;
    description: string;
    icon: LucideIcon;
  }> = [
    {
      value: "featured_home",
      label: text("مساحة رئيسية", "Homepage placement"),
      description: text(
        "ظهور ضمن المساحات المميزة في الصفحة الرئيسية حسب التوفر.",
        "Featured homepage visibility, subject to availability.",
      ),
      icon: Home,
    },
    {
      value: "highlighted",
      label: text("نتائج البحث", "Search results"),
      description: text(
        "إبراز الإعلان داخل النتائج ذات الصلة بعد مراجعة الإدارة.",
        "Highlight the listing inside relevant results after admin review.",
      ),
      icon: Search,
    },
    {
      value: "top_category",
      label: text("الأقسام", "Categories"),
      description: text(
        "ظهور مميز داخل القسم المناسب لإعلانك.",
        "Prominent visibility inside the listing's relevant category.",
      ),
      icon: LayoutGrid,
    },
    {
      value: "urgent",
      label: text("حملة إعلانية", "Advertising campaign"),
      description: text(
        "حملة أو أولوية تسويقية خاصة يراجعها فريق رواج يدوياً.",
        "A custom campaign or marketing priority reviewed manually by RAWAJ.",
      ),
      icon: Megaphone,
    },
  ];

  const load = useCallback(async () => {
    if (!profileId || auth.status !== "signedIn") return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");

    try {
      const [listingsResult, requestsResult] = await Promise.all([
        fetchCurrentUserListings(profileId),
        fetchMyPromotionRequests(profileId),
      ]);
      if (requestId !== requestIdRef.current) return;

      if (!listingsResult.ok) {
        setError(listingsResult.error.message);
        return;
      }
      if (!requestsResult.ok) {
        setError(requestsResult.error.message);
        return;
      }

      setListings(listingsResult.data);
      setRequests(requestsResult.data);
      setSelectedListingId((current) => {
        const stillApproved = listingsResult.data.some(
          (listing) => listing.id === current && listing.status === "approved",
        );
        if (stillApproved) return current;
        return listingsResult.data.find((listing) => listing.status === "approved")?.id ?? "";
      });
      setLoaded(true);
    } catch (caught) {
      if (requestId !== requestIdRef.current) return;
      setError(
        caught instanceof Error
          ? caught.message
          : text("تعذر تحميل بيانات الترويج.", "Could not load promotion data."),
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [auth.status, profileId, text]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) {
      requestIdRef.current += 1;
      setListings([]);
      setRequests([]);
      setLoaded(false);
      setLoading(false);
      setError("");
      setSelectedListingId("");
      return;
    }

    void load();
    return () => {
      requestIdRef.current += 1;
    };
  }, [auth.status, load, profileId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileId || submitInFlightRef.current) return;
    setNotice("");

    if (!loaded || loading) {
      setNotice(text("انتظر اكتمال تحميل بياناتك.", "Wait until your data finishes loading."));
      return;
    }
    if (!selectedListingId) {
      setNotice(text("اختر إعلاناً معتمداً.", "Choose an approved listing."));
      return;
    }
    if (hasPendingForSelectedListing) {
      setNotice(
        text(
          "يوجد طلب ترويج أو Boost قيد المراجعة لهذا الإعلان حالياً.",
          "A promotion or Boost request for this listing is already under review.",
        ),
      );
      return;
    }

    submitInFlightRef.current = true;
    setSaving(true);
    try {
      const result = await createListingPromotionRequest({
        listingId: selectedListingId,
        requesterUserId: profileId,
        promotionType,
        requestedDays,
        paymentMethod: paymentMethod.trim() || null,
        paymentReference: paymentReference.trim() || null,
      });
      if (!result.ok) {
        setNotice(result.error.message);
        return;
      }

      if (receiptFile) {
        const receiptResult = await uploadPromotionReceipt({
          userId: profileId,
          requestId: result.data.id,
          file: receiptFile,
        });
        if (!receiptResult.ok) {
          setNotice(
            text(
              "تم إنشاء الطلب، لكن تعذر رفع الإيصال. لا ترسل طلباً جديداً؛ تواصل مع الدعم لإرفاقه.",
              "The request was created, but the receipt could not upload. Do not resubmit; contact support to attach it.",
            ),
          );
          await load();
          return;
        }
      }

      setPaymentMethod("");
      setPaymentReference("");
      setReceiptFile(null);
      setNotice(
        text(
          "تم إرسال الطلب. ستراجعه الإدارة ثم تتواصل معك بشأن التوفر والتكلفة والتفعيل.",
          "Request sent. Admin will review availability, pricing, and activation with you.",
        ),
      );
      await load();
    } catch (caught) {
      setNotice(
        caught instanceof Error
          ? caught.message
          : text("تعذر إرسال طلب الترويج.", "Could not submit the promotion request."),
      );
    } finally {
      submitInFlightRef.current = false;
      setSaving(false);
    }
  }

  if (auth.status !== "signedIn") {
    return (
      <>
        <PageHeader
          title={text("طلب ترويج", "Promotion request")}
          to="/profile/listings"
          backMode="history"
        />
        <main className="container-wide mobile-page-bottom pt-4">
          <section className="rounded-2xl bg-card p-8 text-center hairline">
            <Megaphone className="mx-auto h-7 w-7 text-gold" />
            <h1 className="mt-3 text-base font-black">
              {text("سجّل الدخول لطلب الترويج", "Log in to request promotion")}
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-muted-foreground">
              {text(
                "طلبات الترويج متاحة للإعلانات المعتمدة التي تملكها.",
                "Promotion requests are available for approved listings you own.",
              )}
            </p>
            <Link
              to="/login"
              className="mt-4 inline-flex rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground"
            >
              {text("تسجيل الدخول", "Log in")}
            </Link>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={text("طلب ترويج", "Promotion request")}
        to="/profile/listings"
        backMode="history"
      />
      <main className="container-wide mobile-page-bottom space-y-5 pt-4">
        <section className="rounded-2xl bg-[#17131d] p-5 text-white shadow-soft sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-200 hairline">
              <Megaphone className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-fuchsia-200/80">
                RAWAJ PROMOTION
              </p>
              <h1 className="mt-1 text-xl font-black">
                {text("اختر أين تريد أن يظهر إعلانك", "Choose where your listing should appear")}
              </h1>
              <p className="mt-2 max-w-2xl text-xs leading-6 text-white/70">
                {text(
                  "للمساحات والحملات استخدم هذا الطلب. لرفع ترتيب إعلانك تلقائياً استخدم Boost.",
                  "Use this request for placements and campaigns. Use Boost for automatic ranking lift.",
                )}
              </p>
            </div>
          </div>
          <Link
            to="/promotion"
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-black text-[#241b0d]"
          >
            <Rocket className="h-4 w-4" />
            Boost
          </Link>
        </section>

        {loading && !loaded ? (
          <StatePanel title={text("جارٍ تحميل بياناتك", "Loading your data")} />
        ) : error && !loaded ? (
          <StatePanel
            title={text("تعذر تحميل بيانات الترويج", "Could not load promotion data")}
            body={error}
            actionLabel={text("إعادة المحاولة", "Try again")}
            onAction={() => void load()}
          />
        ) : approvedListings.length === 0 ? (
          <StatePanel
            title={text(
              "لا توجد إعلانات معتمدة قابلة للترويج",
              "No approved listings available for promotion",
            )}
            body={text(
              "يمكن طلب الترويج فقط لإعلان معتمد تملكه.",
              "Promotion can be requested only for an approved listing you own.",
            )}
          />
        ) : (
          <form onSubmit={(event) => void submit(event)} className="space-y-5">
            {error ? (
              <div className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive hairline">
                {error}
              </div>
            ) : null}

            <section className="rounded-2xl bg-card p-4 hairline sm:p-5">
              <StepTitle number="1" title={text("اختر الإعلان", "Choose the listing")} />
              <select
                value={selectedListingId}
                onChange={(event) => setSelectedListingId(event.target.value)}
                className="input mt-3 min-h-12 w-full"
                aria-label={text("الإعلان", "Listing")}
              >
                {approvedListings.map((listing) => (
                  <option key={listing.id} value={listing.id}>
                    {listing.title}
                  </option>
                ))}
              </select>
              {hasPendingForSelectedListing ? (
                <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs font-semibold text-amber-700 dark:text-amber-200">
                  {text(
                    "يوجد طلب ترويج أو Boost قيد المراجعة لهذا الإعلان.",
                    "A promotion or Boost request is already under review for this listing.",
                  )}
                </p>
              ) : null}
            </section>

            <section className="rounded-2xl bg-card p-4 hairline sm:p-5">
              <StepTitle number="2" title={text("اختر نوع الترويج", "Choose promotion type")} />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {promotionOptions.map((option) => (
                  <PromotionOption
                    key={option.value}
                    option={option}
                    selected={promotionType === option.value}
                    onSelect={() => setPromotionType(option.value)}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-card p-4 hairline sm:p-5">
              <StepTitle number="3" title={text("المدة والتفاصيل", "Duration and details")} />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-muted-foreground">
                    {text("المدة المطلوبة", "Requested duration")}
                  </span>
                  <div className="relative">
                    <Clock3 className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      value={requestedDays}
                      onChange={(event) => setRequestedDays(Number(event.target.value))}
                      className="input min-h-12 w-full ps-10"
                    >
                      {DURATION_OPTIONS.map((days) => (
                        <option key={days} value={days}>
                          {text(`${days} أيام`, `${days} days`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
                <TextField
                  label={text("طريقة الدفع — اختياري", "Payment method — optional")}
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  maxLength={80}
                />
                <TextField
                  label={text("مرجع الدفع — اختياري", "Payment reference — optional")}
                  value={paymentReference}
                  onChange={setPaymentReference}
                  maxLength={160}
                />
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-muted-foreground">
                    {text("إيصال الدفع — اختياري", "Payment receipt — optional")}
                  </span>
                  <span className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold hairline">
                    <FileUp className="h-4 w-4 text-muted-foreground" />
                    <span className="min-w-0 truncate">
                      {receiptFile?.name || text("اختيار ملف", "Choose file")}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                  </span>
                </label>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                {text(
                  "الدفع غير مطلوب قبل إرسال الطلب. اترك بيانات الدفع فارغة إذا لم يتم الاتفاق على السعر بعد.",
                  "Payment is not required before submitting. Leave payment details empty if pricing is not agreed yet.",
                )}
              </p>
            </section>

            <section className="rounded-2xl bg-card p-4 hairline sm:p-5">
              <p className="text-xs leading-6 text-muted-foreground">
                {text(
                  "الإرسال لا يفعّل الترويج تلقائياً. يبدأ الترويج بعد مراجعة الإدارة والاتفاق على التفاصيل.",
                  "Submitting does not activate promotion automatically. Promotion starts after admin review and agreement.",
                )}
              </p>
              <button
                type="submit"
                disabled={saving || loading || hasPendingForSelectedListing}
                aria-busy={saving}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-fuchsia-600 px-5 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {saving
                  ? text("جارٍ الإرسال", "Sending")
                  : text("إرسال طلب الترويج", "Send promotion request")}
              </button>
              {notice ? (
                <p
                  role="status"
                  className="mt-3 rounded-xl bg-muted-surface p-3 text-xs font-semibold"
                >
                  {notice}
                </p>
              ) : null}
            </section>
          </form>
        )}

        <section className="rounded-2xl bg-card p-4 hairline sm:p-5">
          <h2 className="text-sm font-black">{text("طلبات الترويج", "Promotion requests")}</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {text(
              "طلبات Boost تبقى في صفحة Boost ولا نكررها هنا.",
              "Boost orders remain on the Boost page and are not duplicated here.",
            )}
          </p>
          {customRequests.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {text("لا توجد طلبات ترويج مخصصة بعد.", "No custom promotion requests yet.")}
            </p>
          ) : (
            <div className="mt-3 grid gap-2">
              {customRequests.map((request) => (
                <article
                  key={request.id}
                  className="rounded-xl bg-muted-surface p-3 text-xs hairline"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-black text-foreground">
                        {request.listingTitle ?? request.listingId}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {promotionTypeLabel(request.promotionType, text)} · {request.requestedDays}{" "}
                        {text("يوم", "days")}
                      </p>
                    </div>
                    <span className="rounded-full bg-card px-2.5 py-1 text-[10px] font-black hairline">
                      {promotionStatusLabel(request.status, text)}
                    </span>
                  </div>
                  {request.adminNote ? (
                    <p className="mt-2 leading-5 text-muted-foreground">{request.adminNote}</p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <Link
          to="/support"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm font-bold hairline"
        >
          <LifeBuoy className="h-4 w-4" />
          {text("الدعم والمساعدة", "Support")}
        </Link>
      </main>
    </>
  );
}

function PromotionOption({
  option,
  selected,
  onSelect,
}: {
  option: {
    value: PromotionType;
    label: string;
    description: string;
    icon: LucideIcon;
  };
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`rounded-2xl p-4 text-start transition hairline ${
        selected
          ? "bg-fuchsia-500/10 ring-2 ring-fuchsia-500/55"
          : "bg-muted-surface hover:bg-fuchsia-500/5"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-black text-foreground">
        <Icon className="h-4 w-4 text-fuchsia-500" />
        {option.label}
      </span>
      <span className="mt-2 block text-xs leading-6 text-muted-foreground">
        {option.description}
      </span>
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        className="input min-h-12 w-full"
      />
    </label>
  );
}

function StepTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-fuchsia-500/10 text-xs font-black text-fuchsia-500">
        {number}
      </span>
      <h2 className="text-sm font-black text-foreground">{title}</h2>
    </div>
  );
}

function StatePanel({
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
      {body ? <p className="mt-1 text-xs leading-6 text-muted-foreground">{body}</p> : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
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
  if (type === "highlighted") return text("نتائج البحث", "Search results");
  if (type === "top_category") return text("الأقسام", "Categories");
  if (type === "urgent") return text("حملة إعلانية", "Advertising campaign");
  return text("مساحة رئيسية", "Homepage placement");
}
