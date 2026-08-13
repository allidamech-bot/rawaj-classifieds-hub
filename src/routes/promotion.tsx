import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock3,
  FileCheck2,
  LifeBuoy,
  Rocket,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchCurrentUserListings, uploadPromotionReceipt } from "@/lib/classifieds-api";
import type { ClassifiedListing, ClassifiedsError } from "@/lib/classifieds-types";
import {
  SEARCH_BOOST_PACKAGES,
  consumeSearchBoostIntent,
  createSearchBoostRequest,
  fetchMySearchBoostOrders,
  formatBoostCountdown,
  formatSearchBoostPrice,
  isListingEligibleForSearchBoost,
  remainingBoostTime,
  searchBoostDurationLabel,
  searchBoostName,
  type SearchBoostOrder,
  type SearchBoostPackageCode,
} from "@/lib/search-boost-growth";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/promotion")({
  head: () =>
    createSeo({
      title: "Search Boost | RAWAJ / رواج",
      description: "ارفع ترتيب إعلانك في نتائج البحث ذات الصلة على رواج سوريا.",
      path: "/promotion",
      noindex: true,
    }),
  component: PromotionPage,
});

function PromotionPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const profileId = auth.profile?.id ?? null;
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [orders, setOrders] = useState<SearchBoostOrder[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [listingsError, setListingsError] = useState<ClassifiedsError | null>(null);
  const [ordersError, setOrdersError] = useState<ClassifiedsError | null>(null);
  const [hasLoadedListings, setHasLoadedListings] = useState(false);
  const [hasLoadedOrders, setHasLoadedOrders] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [selectedPackageCode, setSelectedPackageCode] =
    useState<SearchBoostPackageCode>("boost_24h");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const listingsRequestIdRef = useRef(0);
  const ordersRequestIdRef = useRef(0);
  const submitInFlightRef = useRef(false);
  const profileIdRef = useRef<string | null>(profileId);
  const intentListingIdRef = useRef<string | null>(null);
  profileIdRef.current = profileId;

  const promotions = useMemo(() => orders.map((order) => order.promotion), [orders]);
  const eligibleListings = useMemo(
    () =>
      listings.filter((listing) =>
        isListingEligibleForSearchBoost(listing, promotions, nowMs),
      ),
    [listings, nowMs, promotions],
  );
  const selectedPackage =
    SEARCH_BOOST_PACKAGES.find((item) => item.code === selectedPackageCode) ??
    SEARCH_BOOST_PACKAGES[1];

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (auth.status === "signedIn" && !intentListingIdRef.current) {
      intentListingIdRef.current = consumeSearchBoostIntent();
    }
  }, [auth.status]);

  useEffect(() => {
    setSelectedListingId((current) => {
      if (eligibleListings.some((listing) => listing.id === current)) return current;
      const intended = intentListingIdRef.current;
      if (intended && eligibleListings.some((listing) => listing.id === intended)) {
        intentListingIdRef.current = null;
        return intended;
      }
      return eligibleListings[0]?.id ?? "";
    });
  }, [eligibleListings]);

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
      } else setListingsError(result.error);
    } catch (error) {
      if (requestId !== listingsRequestIdRef.current || currentProfileId !== profileIdRef.current)
        return;
      setListingsError(unknownError(error, text("تعذر تحميل إعلاناتك.", "Could not load your listings.")));
    } finally {
      if (requestId === listingsRequestIdRef.current) setListingsLoading(false);
    }
  }, [profileId, text]);

  const loadOrders = useCallback(async () => {
    if (!profileId) return;
    const currentProfileId = profileId;
    const requestId = ++ordersRequestIdRef.current;
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const result = await fetchMySearchBoostOrders(currentProfileId);
      if (requestId !== ordersRequestIdRef.current || currentProfileId !== profileIdRef.current)
        return;
      if (result.ok) {
        setOrders(result.data);
        setHasLoadedOrders(true);
      } else setOrdersError(result.error);
    } catch (error) {
      if (requestId !== ordersRequestIdRef.current || currentProfileId !== profileIdRef.current)
        return;
      setOrdersError(unknownError(error, text("تعذر تحميل طلبات Boost.", "Could not load Boost requests.")));
    } finally {
      if (requestId === ordersRequestIdRef.current) setOrdersLoading(false);
    }
  }, [profileId, text]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) {
      listingsRequestIdRef.current += 1;
      ordersRequestIdRef.current += 1;
      setListings([]);
      setOrders([]);
      setHasLoadedListings(false);
      setHasLoadedOrders(false);
      setSelectedListingId("");
      return;
    }
    void loadListings();
    void loadOrders();
    return () => {
      listingsRequestIdRef.current += 1;
      ordersRequestIdRef.current += 1;
    };
  }, [auth.status, loadListings, loadOrders, profileId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileId || submitInFlightRef.current) return;
    setNotice("");
    if (!hasLoadedListings || !hasLoadedOrders || listingsLoading || ordersLoading) {
      setNotice(text("انتظر اكتمال تحميل بياناتك.", "Wait until your data finishes loading."));
      return;
    }
    if (!eligibleListings.some((listing) => listing.id === selectedListingId)) {
      setNotice(text("اختر إعلاناً مؤهلاً لـ Boost.", "Choose a listing eligible for Boost."));
      return;
    }
    if (!paymentMethod.trim()) {
      setNotice(text("أدخل طريقة الدفع المستخدمة.", "Enter the payment method used."));
      return;
    }
    if (!paymentReference.trim() && !receiptFile) {
      setNotice(
        text(
          "أدخل مرجع الدفع أو ارفع إيصال الدفع.",
          "Enter a payment reference or upload a payment receipt.",
        ),
      );
      return;
    }

    submitInFlightRef.current = true;
    setSaving(true);
    try {
      const result = await createSearchBoostRequest({
        listingId: selectedListingId,
        packageCode: selectedPackageCode,
        paymentMethod,
        paymentReference,
      });
      if (!result.ok) {
        setNotice(result.error.message);
        return;
      }
      if (receiptFile) {
        const receipt = await uploadPromotionReceipt({
          userId: profileId,
          requestId: result.data.id,
          file: receiptFile,
        });
        if (!receipt.ok) {
          setNotice(
            text(
              "تم إنشاء الطلب، لكن تعذر رفع الإيصال. لا ترسل طلباً جديداً؛ تواصل مع الدعم لإرفاقه.",
              "The request was created, but the receipt could not upload. Do not resubmit; contact support to attach it.",
            ),
          );
          await loadOrders();
          return;
        }
      }
      setNotice(
        text(
          "تم إرسال طلب Search Boost. يبدأ الوقت فقط بعد مراجعة الدفع وموافقة الإدارة.",
          "Search Boost submitted. Time starts only after payment review and admin approval.",
        ),
      );
      setPaymentMethod("");
      setPaymentReference("");
      setReceiptFile(null);
      await Promise.all([loadOrders(), loadListings()]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text("تعذر إرسال الطلب.", "Could not submit the request."));
    } finally {
      submitInFlightRef.current = false;
      setSaving(false);
    }
  }

  if (auth.status !== "signedIn") {
    return (
      <>
        <PageHeader title="Boost" to="/more" backMode="history" />
        <main className="container-wide mobile-page-bottom pt-4">
          <Panel
            icon={<Rocket className="h-7 w-7 text-amber-700" />}
            title={text("سجّل الدخول لتفعيل Boost", "Log in to use Boost")}
            body={text(
              "Search Boost متاح للإعلانات المعتمدة التي تملكها.",
              "Search Boost is available for approved listings you own.",
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
      <PageHeader title="Boost" to="/more" backMode="history" />
      <main className="container-wide mobile-page-bottom space-y-5 pt-4" dir={language === "ar" ? "rtl" : "ltr"}>
        <section className="overflow-hidden rounded-2xl bg-[#241b0d] p-5 text-[#fff8e8] shadow-soft sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-400 text-[#241b0d]">
              <Rocket className="h-7 w-7" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-black sm:text-2xl">Search Boost</h1>
              <p className="mt-1 max-w-2xl text-sm leading-7 text-amber-50/80">
                {text(
                  "ارفع إعلانك في النتائج العادية ذات الصلة فقط. Boost لا يتجاوز البحث أو القسم أو الفلاتر.",
                  "Move your listing up in relevant normal results. Boost never bypasses search, category, or filters.",
                )}
              </p>
            </div>
          </div>
        </section>

        {listingsError && !hasLoadedListings ? (
          <Panel title={text("تعذر تحميل إعلاناتك", "Could not load your listings")} body={listingsError.message}>
            <RetryButton loading={listingsLoading} onClick={() => void loadListings()} text={text} />
          </Panel>
        ) : ordersError && !hasLoadedOrders ? (
          <Panel title={text("تعذر تحميل طلبات Boost", "Could not load Boost requests")} body={ordersError.message}>
            <RetryButton loading={ordersLoading} onClick={() => void loadOrders()} text={text} />
          </Panel>
        ) : listingsLoading || ordersLoading || !hasLoadedListings || !hasLoadedOrders ? (
          <Panel title={text("جارٍ تجهيز Search Boost", "Preparing Search Boost")} />
        ) : (
          <form onSubmit={(event) => void submit(event)} aria-busy={saving} className="space-y-5">
            <section className="rounded-2xl bg-card p-4 hairline sm:p-5">
              <StepTitle number="1" title={text("اختر إعلاناً مؤهلاً", "Choose an eligible listing")} />
              {eligibleListings.length ? (
                <select
                  value={selectedListingId}
                  onChange={(event) => setSelectedListingId(event.target.value)}
                  className="input mt-3 min-h-12 w-full"
                  aria-label={text("الإعلان", "Listing")}
                >
                  {eligibleListings.map((listing) => (
                    <option key={listing.id} value={listing.id}>{listing.title}</option>
                  ))}
                </select>
              ) : (
                <div className="mt-3 rounded-xl bg-muted-surface p-4 text-sm leading-6 text-muted-foreground">
                  {text(
                    "لا يوجد إعلان معتمد ومتاح من دون Boost نشط أو طلب مفتوح حالياً.",
                    "No approved available listing without an active Boost or open request is currently eligible.",
                  )}
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-card p-4 hairline sm:p-5">
              <StepTitle number="2" title={text("اختر مدة Boost", "Choose a Boost duration")} />
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {SEARCH_BOOST_PACKAGES.map((boostPackage) => {
                  const selected = boostPackage.code === selectedPackageCode;
                  return (
                    <button
                      key={boostPackage.code}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setSelectedPackageCode(boostPackage.code)}
                      className={`relative min-w-0 rounded-2xl p-4 text-start transition hairline ${
                        selected ? "bg-amber-500/12 ring-2 ring-amber-600" : "bg-muted-surface hover:bg-amber-500/7"
                      }`}
                    >
                      {boostPackage.recommended ? (
                        <span className="absolute end-2 top-2 rounded-full bg-amber-600 px-2 py-1 text-[9px] font-extrabold text-white">
                          {text("الأكثر اختياراً", "Popular")}
                        </span>
                      ) : null}
                      <span className="block pe-14 text-sm font-black">{searchBoostName(boostPackage.code, text)}</span>
                      <span className="mt-2 block text-xs text-muted-foreground">{searchBoostDurationLabel(boostPackage.code, text)}</span>
                      <span className="mt-3 block text-base font-black text-amber-800 dark:text-amber-300">
                        {formatSearchBoostPrice(boostPackage.priceMinor, language)}
                      </span>
                      {selected ? <CheckCircle2 className="absolute bottom-3 end-3 h-4 w-4 text-amber-700" /> : null}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl bg-card p-4 hairline sm:p-5">
              <StepTitle number="3" title={text("أثبت عملية الدفع", "Provide payment proof")} />
              <div className="mt-3 rounded-xl bg-amber-500/10 p-4 text-xs leading-6 text-foreground">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-amber-700" />
                  <p>
                    {text(
                      `القيمة ${formatSearchBoostPrice(selectedPackage.priceMinor, language)}. استخدم طريقة الدفع التي أكدها لك فريق رواج، ثم اكتب اسم الطريقة والمرجع وارفع الإيصال. لن تبدأ مدة Boost قبل التحقق والموافقة.`,
                      `Amount: ${formatSearchBoostPrice(selectedPackage.priceMinor, language)}. Use the payment method confirmed by the RAWAJ team, then enter the method and reference and upload the receipt. Boost time starts only after verification and approval.`,
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label={text("طريقة الدفع المستخدمة", "Payment method used")} required>
                  <input
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    maxLength={80}
                    className="input min-h-12 w-full"
                    autoComplete="off"
                  />
                </Field>
                <Field label={text("مرجع الدفع", "Payment reference")}>
                  <input
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    maxLength={160}
                    className="input min-h-12 w-full"
                    autoComplete="off"
                  />
                </Field>
                <Field label={text("إيصال الدفع الخاص", "Private payment receipt")}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold hairline focus-within:ring-2 focus-within:ring-amber-600">
                    <Upload className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">
                      {receiptFile?.name ?? text("اختر صورة أو PDF", "Choose an image or PDF")}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                  </label>
                </Field>
                <div className="flex items-center gap-2 self-end rounded-xl bg-emerald-500/8 p-3 text-[11px] leading-5 text-muted-foreground">
                  <FileCheck2 className="h-4 w-4 shrink-0 text-emerald-700" />
                  {text(
                    "الإيصال خاص ولا يراه إلا المشرف المخوّل.",
                    "The receipt stays private and is visible only to authorized moderators.",
                  )}
                </div>
              </div>
              <button
                type="submit"
                disabled={saving || !selectedListingId || !eligibleListings.length}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <Rocket className="h-4 w-4" />
                {saving ? text("جارٍ إرسال الطلب", "Submitting request") : text("إرسال طلب Search Boost", "Submit Search Boost")}
              </button>
              {notice ? <p role="status" className="mt-3 rounded-xl bg-muted-surface p-3 text-xs font-semibold leading-6">{notice}</p> : null}
            </section>
          </form>
        )}

        <section className="rounded-2xl bg-card p-4 hairline sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-black">{text("طلبات Search Boost", "Search Boost requests")}</h2>
            <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-bold text-muted-foreground">{orders.length}</span>
          </div>
          {orders.length ? (
            <div className="mt-3 grid gap-3">
              {orders.map((order) => {
                const remaining = remainingBoostTime(order.promotion.endsAt, nowMs);
                const active = order.promotion.status === "approved" && remaining > 0;
                const expired = order.promotion.status === "expired" || (order.promotion.status === "approved" && order.promotion.endsAt && remaining === 0);
                return (
                  <article key={order.promotion.id} className="rounded-xl bg-muted-surface p-4 hairline">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-black">{order.promotion.listingTitle ?? order.promotion.listingId}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {searchBoostDurationLabel(order.package.code, text)} · {formatSearchBoostPrice(order.promotion.searchBoostPriceSyp ?? order.package.priceMinor, language)}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold ${active ? "bg-emerald-500/12 text-emerald-800" : expired ? "bg-muted text-muted-foreground" : order.promotion.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-amber-500/12 text-amber-800"}`}>
                        {active
                          ? text("نشط", "Active")
                          : expired
                            ? text("منتهي", "Expired")
                            : order.promotion.status === "rejected"
                              ? text("مرفوض", "Rejected")
                              : order.promotion.status === "cancelled"
                                ? text("ملغي", "Cancelled")
                                : text("بانتظار مراجعة الدفع", "Pending payment review")}
                      </span>
                    </div>
                    {active ? (
                      <p className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-800">
                        <Clock3 className="h-4 w-4" />
                        {text("الوقت المتبقي", "Time remaining")}: <span dir="ltr">{formatBoostCountdown(remaining)}</span>
                      </p>
                    ) : null}
                    {order.promotion.adminNote ? <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{order.promotion.adminNote}</p> : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{text("لا توجد طلبات Boost بعد.", "No Boost requests yet.")}</p>
          )}
        </section>

        <Link to="/support" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm font-bold hairline">
          <LifeBuoy className="h-4 w-4" />
          {text("الدعم والمساعدة", "Support & help")}
        </Link>
      </main>
    </>
  );
}

function StepTitle({ number, title }: { number: string; title: string }) {
  return (
    <h2 className="flex items-center gap-3 text-base font-black">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-600 text-xs text-white">{number}</span>
      {title}
    </h2>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-muted-foreground">
        {label}{required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

function Panel({ icon, title, body, children }: { icon?: React.ReactNode; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-8 text-center hairline">
      {icon ? <span className="mx-auto grid place-items-center">{icon}</span> : null}
      <h2 className={`${icon ? "mt-3" : ""} text-base font-black`}>{title}</h2>
      {body ? <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-muted-foreground">{body}</p> : null}
      {children}
    </section>
  );
}

function RetryButton({ loading, onClick, text }: { loading: boolean; onClick: () => void; text: (ar: string, en: string) => string }) {
  return (
    <button type="button" disabled={loading} onClick={onClick} className="rawaj-button-primary mt-4 px-4 py-2 disabled:opacity-60">
      {loading ? text("جارٍ التحميل", "Loading") : text("إعادة المحاولة", "Try again")}
    </button>
  );
}

function unknownError(error: unknown, fallback: string): ClassifiedsError {
  return { code: "unknown", message: error instanceof Error ? error.message : fallback };
}
