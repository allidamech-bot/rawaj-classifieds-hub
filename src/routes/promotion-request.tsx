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
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  createListingPromotionRequest,
  fetchCurrentUserListings,
  fetchMyPromotionRequests,
  uploadPromotionReceipt,
} from "@/lib/classifieds-api";
import type {
  ClassifiedListing,
  ClassifiedsError,
  ListingPromotionRequest,
  PromotionType,
} from "@/lib/classifieds-types";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

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
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [requests, setRequests] = useState<ListingPromotionRequest[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [listingsError, setListingsError] = useState<ClassifiedsError | null>(null);
  const [requestsError, setRequestsError] = useState<ClassifiedsError | null>(null);
  const [hasLoadedListings, setHasLoadedListings] = useState(false);
  const [hasLoadedRequests, setHasLoadedRequests] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [promotionType, setPromotionType] = useState<PromotionType>("featured_home");
  const [requestedDays, setRequestedDays] = useState(7);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const listingsRequestIdRef = useRef(0);
  const requestsRequestIdRef = useRef(0);
  const submitInFlightRef = useRef(false);
  const profileIdRef = useRef<string | null>(profileId);
  profileIdRef.current = profileId;

  const approvedListings = useMemo(
    () => listings.filter((listing) => listing.status === "approved"),
    [listings],
  );
  const generalRequests = useMemo(
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
    icon: typeof Home;
  }> = [
    {
      value: "featured_home",
      label: text("مساحة رئيسية", "Homepage placement"),
      description: text(
        "طلب ظهور ضمن المساحات المميزة في الصفحة الرئيسية حسب التوفر.",
        "Request a featured homepage placement, subject to availability.",
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
        "طلب ظهور مميز داخل القسم المناسب لإعلانك.",
        "Request prominent visibility inside the listing's relevant category.",
      ),
      icon: LayoutGrid,
    },
    {
      value: "urgent",
      label: text("حملة إعلانية", "Advertising campaign"),
      description: text(
        "طلب حملة أو أولوية تسويقية خاصة يراجعها فريق رواج يدوياً.",
        "Request a custom campaign or marketing priority reviewed manually by RAWAJ.",
      ),
      icon: Megaphone,
    },
  ];
  const durationOptions = [3, 7, 14, 30];

  const loadListings = useCallback(async () => {
    if (!profileId) return;
    const currentProfileId = profileId;
    const requestId = ++listingsRequestIdRef.current;
    setListingsLoading(true);
    setListingsError(null);
    try {
      const result = await fetchCurrentUserListings(currentProfileId);
      if (requestId !== listingsRequestIdRef.current || currentProfileId !== profileIdRef.current)
        return;
      if (result.ok) {
        setListings(result.data);
        setHasLoadedListings(true);
        setSelectedListingId((current) => {
          const currentStillEligible = result.data.some(
            (item) => item.id === current && item.status === "approved",
          );
          if (currentStillEligible) return current;
          return result.data.find((item) => item.status === "approved")?.id ?? "";
        });
      } else {
        setListingsError(result.error);
      }
    } catch (caught) {
      if (requestId !== listingsRequestIdRef.current || currentProfileId !== profileIdRef.current)
        return;
      setListingsError({
        code: "unknown",
        message:
          caught instanceof Error
            ? caught.message
            : text("تعذر تحميل إعلاناتك.", "Could not load your listings."),
        operation: "promotion_request_listings_load",
      });
    } finally {
      if (requestId === listingsRequestIdRef.current && currentProfileId === profileIdRef.current) {
        setListingsLoading(false);
      }
    }
  }, [profileId, text]);

  const loadRequests = useCallback(async () => {
    if (!profileId) return;
    const currentProfileId = profileId;
    const requestId = ++requestsRequestIdRef.current;
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const result = await fetchMyPromotionRequests(currentProfileId);
      if (requestId !== requestsRequestIdRef.current || currentProfileId !== profileIdRef.current)
        return;
      if (result.ok) {
        setRequests(result.data);
        setHasLoadedRequests(true);
      } else {
        setRequestsError(result.error);
      }
    } catch (caught) {
      if (requestId !== requestsRequestIdRef.current || currentProfileId !== profileIdRef.current)
        return;
      setRequestsError({
        code: "unknown",
        message:
          caught instanceof Error
            ? caught.message
            : text("تعذر تحميل طلبات الترويج.", "Could not load promotion requests."),
        operation: "promotion_request_history_load",
      });
    } finally {
      if (requestId === requestsRequestIdRef.current && currentProfileId === profileIdRef.current) {
        setRequestsLoading(false);
      }
    }
  }, [profileId, text]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) {
      listingsRequestIdRef.current += 1;
      requestsRequestIdRef.current += 1;
      setListings([]);
      setRequests([]);
      setListingsLoading(false);
      setRequestsLoading(false);
      setListingsError(null);
      setRequestsError(null);
      setHasLoadedListings(false);
      setHasLoadedRequests(false);
      setSelectedListingId("");
      return;
    }

    setListings([]);
    setRequests([]);
    setListingsError(null);
    setRequestsError(null);
    setHasLoadedListings(false);
    setHasLoadedRequests(false);
    setSelectedListingId("");
    void loadListings();
    void loadRequests();

    return () => {
      listingsRequestIdRef.current += 1;
      requestsRequestIdRef.current += 1;
    };
  }, [auth.status, loadListings, loadRequests, profileId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentProfileId = profileId;
    if (!currentProfileId || submitInFlightRef.current) return;
    setNotice("");

    if (!hasLoadedListings || !hasLoadedRequests || listingsLoading || requestsLoading) {
      setNotice(
        text(
          "انتظر اكتمال تحميل بياناتك قبل الإرسال.",
          "Wait until your data finishes loading before submitting.",
        ),
      );
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
        requesterUserId: currentProfileId,
        promotionType,
        requestedDays,
        paymentMethod: paymentMethod.trim() || null,
        paymentReference: paymentReference.trim() || null,
      });
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setNotice(result.error.message);
        return;
      }

      setRequests((current) => [
        result.data,
        ...current.filter((item) => item.id !== result.data.id),
      ]);
      setHasLoadedRequests(true);

      if (receiptFile) {
        const receiptResult = await uploadPromotionReceipt({
          userId: currentProfileId,
          requestId: result.data.id,
          file: receiptFile,
        });
        if (currentProfileId !== profileIdRef.current) return;
        if (!receiptResult.ok) {
          setNotice(
            text(
              "تم إنشاء الطلب، لكن تعذر رفع الإيصال. لا ترسل طلباً جديداً؛ تواصل مع الدعم لإرفاقه.",
              "The request was created, but the receipt could not upload. Do not resubmit; contact support to attach it.",
            ),
          );
          await loadRequests();
          return;
        }
      }

      setNotice(
        text(
          "تم إرسال طلب الترويج. ستراجعه الإدارة ثم تتواصل معك بشأن التوفر والتكلفة والتفعيل.",
          "Promotion request sent. Admin will review availability, pricing, and activation with you.",
        ),
      );
      setPaymentMethod("");
      setPaymentReference("");
      setReceiptFile(null);
      await loadRequests();
    } catch (caught) {
      if (currentProfileId === profileIdRef.current) {
        setNotice(
          caught instanceof Error
            ? caught.message
            : text("تعذر إرسال طلب الترويج.", "Could not submit the promotion request."),
        );
      }
    } finally {
      submitInFlightRef.current = false;
      if (currentProfileId === profileIdRef.current) setSaving(false);
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
          <Panel
            icon={<Megaphone className="h-7 w-7 text-gold" />}
            title={text("سجّل الدخول لطلب الترويج", "Log in to request promotion")}
            body={text(
              "طلبات الترويج متاحة للإعلانات المعتمدة التي تملكها.",
              "Promotion requests are available for approved listings you own.",
            )}
          >
            <Link to="/login" className="rawaj-button-primary mt-4 inline-flex px-5 py-2.5">
              {text("تسجيل الدخول", "Log in")}
            </Link>
          </Panel>
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
        <section className="overflow-hidden rounded-2xl bg-[#17131d] p-5 text-white shadow-soft sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-200 hairline">
              <Megaphone className="h-7 w-7" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-fuchsia-200/80">
                RAWAJ PROMOTION
              </p>
              <h1 className="mt-1 text-xl font-black sm:text-2xl">
                {text("اختر أين تريد أن يظهر إعلانك", "Choose where your listing should appear")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-white/70">
                {text(
                  "هذا المسار للترويج المخصص والحملات. أما رفع ترتيب الإعلان تلقائياً داخل النتائج فله Boost منفصل.",
                  "This flow is for custom promotion and campaigns. Automatic ranking in relevant results remains a separate Boost product.",
                )}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/promotion"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-black text-[#241b0d]"
            >
              <Rocket className="h-4 w-4" />
              Boost
            </Link>
            <Link
              to="/profile/listings"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/7 px-4 py-2 text-xs font-bold text-white hairline"
            >
              {text("العودة إلى متجري", "Back to my store")}
            </Link>
          </div>
        </section>

        {listingsLoading && !hasLoadedListings ? (
          <Panel title={text("جارٍ تحميل إعلاناتك", "Loading your listings")} />
        ) : listingsError && !hasLoadedListings ? (
          <Panel
            title={text("تعذر تحميل إعلاناتك", "Could not load your listings")}
            body={listingsError.message}
            actionLabel={text("إعادة المحاولة", "Try again")}
            onAction={() => void loadListings()}
            actionDisabled={listingsLoading}
          />
        ) : approvedListings.length === 0 ? (
          <Panel
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
          <form
            onSubmit={(event) => void submit(event)}
            aria-busy={saving}
            className="space-y-5"
          >
            {listingsError ? (
              <RecoveryNotice
                title={text("تعذر تحديث إعلاناتك", "Could not refresh your listings")}
                body={listingsError.message}
                actionLabel={text("إعادة المحاولة", "Try again")}
                onAction={() => void loadListings()}
                actionDisabled={listingsLoading}
              />
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
                    "هذا الإعلان لديه طلب ترويج أو Boost قيد المراجعة. انتظر قرار الإدارة قبل إرسال طلب جديد.",
                    "This listing already has a promotion or Boost request under review. Wait for the admin decision before submitting another.",
                  )}
                </p>
              ) : null}
            </section>

            <section className="rounded-2xl bg-card p-4 hairline sm:p-5">
              <StepTitle number="2" title={text("اختر نوع الترويج", "Choose promotion type")} />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {promotionOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = option.value === promotionType;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setPromotionType(option.value)}
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
                })}
              </div>
            </section>

            <section className="rounded-2xl bg-card p-4 hairline sm:p-5">
              <StepTitle number="3" title={text("المدة وبيانات التواصل المالي", "Duration and payment details")} />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label={text("المدة المطلوبة", "Requested duration")}>
                  <div className="relative">
                    <Clock3 className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      value={requestedDays}
                      onChange={(event) => setRequestedDays(Number(event.target.value))}
                      className="input min-h-12 w-full ps-10"
                    >
                      {durationOptions.map((days) => (
                        <option key={days} value={days}>
                          {text(`${days} أيام`, `${days} days`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </Field>
                <Field label={text("طريقة الدفع — اختياري", "Payment method — optional")}>
                  <input
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    maxLength={80}
                    className="input min-h-12 w-full"
                    placeholder={text("مثال: تحويل بنكي", "Example: bank transfer")}
                  />
                </Field>
                <Field label={text("مرجع الدفع — اختياري", "Payment reference — optional")}>
                  <input
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    maxLength={160}
                    className="input min-h-12 w-full"
                  />
                </Field>
                <Field label={text("إيصال الدفع — اختياري", "Payment receipt — optional")}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold hairline">
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
                  </label>
                </Field>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                {text(
                  "لا يلزم الدفع قبل إرسال الطلب. إذا لم تكن قد اتفقت على السعر بعد، اترك حقول الدفع فارغة وستتواصل الإدارة معك.",
                  "Payment is not required before submitting. If pricing has not been agreed yet, leave payment fields empty and admin will contact you.",
                )}
              </p>
            </section>

            <section className="rounded-2xl bg-card p-4 hairline sm:p-5">
              <StepTitle number="4" title={text("إرسال للمراجعة", "Send for review")} />
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                {text(
                  "الإرسال لا يفعّل الترويج تلقائياً. تبدأ المساحة أو الحملة فقط بعد مراجعة الإدارة والاتفاق على التفاصيل.",
                  "Submitting does not activate promotion automatically. Placement or campaign starts only after admin review and agreement on details.",
                )}
              </p>
              <button
                type="submit"
                disabled={
                  saving ||
                  !selectedListingId ||
                  !hasLoadedListings ||
                  !hasLoadedRequests ||
                  hasPendingForSelectedListing
                }
                aria-busy={saving}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-fuchsia-600 px-5 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {saving
                  ? text("جارٍ الإرسال", "Sending")
                  : text("إرسال طلب الترويج", "Send promotion request")}
              </button>
              {notice ? (
                <p role="status" className="mt-3 rounded-xl bg-muted-surface p-3 text-xs font-semibold">
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
          {requestsLoading && !hasLoadedRequests ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {text("جارٍ تحميل طلباتك", "Loading your requests")}
            </p>
          ) : requestsError && !hasLoadedRequests ? (
            <RecoveryNotice
              title={text("تعذر تحميل طلباتك", "Could not load your requests")}
              body={requestsError.message}
              actionLabel={text("إعادة المحاولة", "Try again")}
              onAction={() => void loadRequests()}
              actionDisabled={requestsLoading}
            />
          ) : (
            <>
              {requestsError ? (
                <RecoveryNotice
                  title={text("تعذر تحديث طلباتك", "Could not refresh your requests")}
                  body={requestsError.message}
                  actionLabel={text("إعادة المحاولة", "Try again")}
                  onAction={() => void loadRequests()}
                  actionDisabled={requestsLoading}
                />
              ) : null}
              {generalRequests.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {text("لا توجد طلبات ترويج مخصصة بعد.", "No custom promotion requests yet.")}
                </p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {generalRequests.map((request) => (
                    <article key={request.id} className="rounded-xl bg-muted-surface p-3 text-xs hairline">
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
            </>
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

function StepTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-fuchsia-500/12 text-xs font-black text-fuchsia-500">
        {number}
      </span>
      <h2 className="text-sm font-black text-foreground">{title}</h2>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Panel({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  actionDisabled,
  children,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-card p-8 text-center hairline">
      {icon ? <div className="mx-auto mb-3 w-fit">{icon}</div> : null}
      <p className="text-sm font-bold">{title}</p>
      {body ? <p className="mt-1 text-xs leading-6 text-muted-foreground">{body}</p> : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          {actionLabel}
        </button>
      ) : null}
      {children}
    </section>
  );
}

function RecoveryNotice({
  title,
  body,
  actionLabel,
  onAction,
  actionDisabled,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive hairline">
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-xs leading-5">{body}</p>
      <button
        type="button"
        onClick={onAction}
        disabled={actionDisabled}
        className="mt-3 rounded-xl bg-card px-4 py-2 text-xs font-bold text-foreground hairline disabled:opacity-60"
      >
        {actionLabel}
      </button>
    </div>
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
