import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, CalendarDays, Megaphone, MonitorSmartphone, Send, Store } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import {
  consumeAdvertisingRequestIntent,
  createAdvertisingRequest,
  fetchMyAdvertisingRequests,
  type AdvertisingRequest,
  type AdvertisingRequestDevice,
  type AdvertisingRequestKind,
} from "@/lib/advertising-request";
import { fetchCurrentUserListings } from "@/lib/classifieds-api";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

const searchSchema = z.object({
  placement: z.enum(["home", "search_results", "categories", "campaign"]).optional(),
  listing: z.string().max(120).optional(),
});

export const Route = createFileRoute("/advertise")({
  validateSearch: searchSchema,
  head: () =>
    createSeo({
      title: "أعلن على رواج | مساحات إعلانية وحملات",
      description:
        "اطلب مساحة إعلانية في رواج أو حملة مخصصة، ثم راجع السعر والتجهيز مع فريق رواج قبل التفعيل.",
      path: "/advertise",
      noindex: true,
    }),
  component: AdvertisePage,
});

interface RequestKindOption {
  value: AdvertisingRequestKind;
  ar: string;
  en: string;
  hintAr: string;
  hintEn: string;
}

const requestKinds: RequestKindOption[] = [
  {
    value: "home",
    ar: "الرئيسية",
    en: "Home",
    hintAr: "ظهور في المساحة الإعلانية بالصفحة الرئيسية",
    hintEn: "Placement on the home page",
  },
  {
    value: "search_results",
    ar: "نتائج البحث",
    en: "Search results",
    hintAr: "ظهور أثناء تصفح نتائج البحث",
    hintEn: "Placement within search results",
  },
  {
    value: "categories",
    ar: "الأقسام",
    en: "Categories",
    hintAr: "ظهور داخل صفحات الأقسام",
    hintEn: "Placement on category pages",
  },
  {
    value: "campaign",
    ar: "حملة إعلانية",
    en: "Ad campaign",
    hintAr: "حملة مخصصة بأكثر من موضع حسب الاتفاق",
    hintEn: "A custom multi-placement campaign",
  },
];

function AdvertisePage() {
  const auth = useAuth();
  const search = Route.useSearch();
  const { language, text } = useUiPreferences();
  const profileId = auth.profile?.id ?? null;
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [requests, setRequests] = useState<AdvertisingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [kind, setKind] = useState<AdvertisingRequestKind>(search.placement ?? "home");
  const [listingId, setListingId] = useState(search.listing ?? "");
  const [requestedDays, setRequestedDays] = useState(14);
  const [device, setDevice] = useState<AdvertisingRequestDevice>("both");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [budgetNote, setBudgetNote] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const requestIdRef = useRef(0);
  const submitInFlightRef = useRef(false);
  const intentConsumedRef = useRef(false);

  const approvedListings = useMemo(
    () => listings.filter((listing) => listing.status === "approved" && !listing.archivedAt),
    [listings],
  );

  const load = useCallback(async () => {
    if (!profileId || auth.status !== "signedIn") return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError("");

    const [listingsResult, requestsResult] = await Promise.all([
      fetchCurrentUserListings(profileId),
      fetchMyAdvertisingRequests(),
    ]);
    if (requestId !== requestIdRef.current) return;

    setLoading(false);
    if (!listingsResult.ok) {
      setLoadError(listingsResult.error.message);
      return;
    }
    if (!requestsResult.ok) {
      setLoadError(requestsResult.error.message);
      return;
    }

    setListings(listingsResult.data);
    setRequests(requestsResult.data);
    setLoaded(true);
  }, [auth.status, profileId]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) {
      requestIdRef.current += 1;
      setListings([]);
      setRequests([]);
      setLoaded(false);
      return;
    }
    void load();
    return () => {
      requestIdRef.current += 1;
    };
  }, [auth.status, load, profileId]);

  useEffect(() => {
    if (auth.status !== "signedIn" || intentConsumedRef.current) return;
    intentConsumedRef.current = true;
    const intendedListingId = consumeAdvertisingRequestIntent();
    if (intendedListingId) setListingId(intendedListingId);
  }, [auth.status]);

  useEffect(() => {
    if (!loaded || !listingId) return;
    if (!approvedListings.some((listing) => listing.id === listingId)) setListingId("");
  }, [approvedListings, listingId, loaded]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInFlightRef.current || auth.status !== "signedIn") return;

    submitInFlightRef.current = true;
    setSaving(true);
    setNotice("");
    try {
      const result = await createAdvertisingRequest({
        listingId: listingId || null,
        kind,
        requestedDays,
        device,
        destinationUrl,
        budgetNote,
        customerNote,
      });
      if (!result.ok) {
        setNotice(result.error.message);
        return;
      }

      setNotice(
        text(
          "تم إرسال طلب الإعلان. سيظهر للإدارة للمراجعة، ولن يتم تفعيل أو احتساب أي إعلان قبل الاتفاق معك على السعر والتجهيز.",
          "Your advertising request was sent for admin review. Nothing is activated or charged until price and setup are agreed with you.",
        ),
      );
      setDestinationUrl("");
      setBudgetNote("");
      setCustomerNote("");
      await load();
    } finally {
      submitInFlightRef.current = false;
      setSaving(false);
    }
  }

  if (auth.status === "loading") {
    return (
      <>
        <PageHeader title={text("أعلن على رواج", "Advertise on RAWAJ")} />
        <main className="container-wide mobile-page-bottom pt-4">
          <StatePanel title={text("جارٍ تجهيز طلب الإعلان", "Preparing advertising request")} />
        </main>
      </>
    );
  }

  if (auth.status !== "signedIn") {
    return (
      <>
        <PageHeader
          title={text("أعلن على رواج", "Advertise on RAWAJ")}
          to="/more"
          backMode="history"
        />
        <main className="container-wide mobile-page-bottom pt-4">
          <StatePanel
            title={text("سجّل الدخول لإرسال طلب إعلان", "Log in to request advertising")}
            body={text(
              "بعد تسجيل الدخول يمكنك طلب مساحة في الرئيسية أو البحث أو الأقسام، أو طلب حملة إعلانية مخصصة.",
              "After logging in you can request home, search, category placement, or a custom campaign.",
            )}
          >
            <Link
              to="/login"
              className="rawaj-button-primary mt-4 inline-flex min-h-11 items-center px-5"
            >
              {text("تسجيل الدخول", "Log in")}
            </Link>
          </StatePanel>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={text("أعلن على رواج", "Advertise on RAWAJ")}
        to="/more"
        backMode="history"
      />
      <main
        className="rawaj-advertise-page container-wide mobile-page-bottom space-y-5 pt-4"
        dir={language === "ar" ? "rtl" : "ltr"}
      >
        <AdvertisingHero text={text} />

        {loadError ? (
          <section className="rounded-2xl bg-card p-4 hairline">
            <p role="alert" className="text-xs font-semibold text-destructive">
              {loadError}
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={() => void load()}
              className="rawaj-button-primary mt-3 min-h-10 px-4 text-xs"
            >
              {text("إعادة المحاولة", "Try again")}
            </button>
          </section>
        ) : null}

        <form onSubmit={(event) => void submit(event)} aria-busy={saving} className="space-y-5">
          <section className="rounded-2xl bg-card p-4 hairline sm:p-5">
            <StepTitle
              icon={<Megaphone />}
              title={text("أين تريد الإعلان؟", "Where do you want to advertise?")}
            />
            <div
              className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
              role="radiogroup"
              aria-label={text("نوع الطلب الإعلاني", "Advertising request type")}
            >
              {requestKinds.map((item) => {
                const selected = item.value === kind;
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-selected={selected}
                    onClick={() => setKind(item.value)}
                    className="rawaj-advertise-kind min-h-24 rounded-2xl bg-muted-surface p-3 text-start hairline"
                  >
                    <strong className="block text-sm">{text(item.ar, item.en)}</strong>
                    <span className="mt-1 block text-[10px] leading-5 text-muted-foreground">
                      {text(item.hintAr, item.hintEn)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl bg-card p-4 hairline sm:p-5">
            <StepTitle
              icon={<Store />}
              title={text("اربط الطلب بإعلانك إن رغبت", "Link one of your listings if useful")}
            />
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-bold text-muted-foreground">
                {text("الإعلان المرتبط", "Related listing")}
              </span>
              <select
                value={listingId}
                onChange={(event) => setListingId(event.target.value)}
                className="input min-h-12 w-full"
                disabled={loading && !loaded}
              >
                <option value="">
                  {text("بدون ربط بإعلان — طلب عام", "No listing — general request")}
                </option>
                {approvedListings.map((listing) => (
                  <option key={listing.id} value={listing.id}>
                    {listing.title}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="rounded-2xl bg-card p-4 hairline sm:p-5">
            <StepTitle
              icon={<CalendarDays />}
              title={text("المدة والاستهداف", "Duration and targeting")}
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label={text("المدة المطلوبة", "Requested duration")}>
                <select
                  value={requestedDays}
                  onChange={(event) => setRequestedDays(Number(event.target.value))}
                  className="input min-h-12 w-full"
                >
                  <option value={7}>{text("7 أيام", "7 days")}</option>
                  <option value={14}>{text("14 يوماً", "14 days")}</option>
                  <option value={30}>{text("30 يوماً", "30 days")}</option>
                  <option value={60}>{text("60 يوماً", "60 days")}</option>
                  <option value={90}>{text("90 يوماً", "90 days")}</option>
                </select>
              </Field>
              <Field label={text("الأجهزة", "Devices")}>
                <select
                  value={device}
                  onChange={(event) => setDevice(event.target.value as AdvertisingRequestDevice)}
                  className="input min-h-12 w-full"
                >
                  <option value="both">{text("الجوال وسطح المكتب", "Mobile and desktop")}</option>
                  <option value="mobile">{text("الجوال فقط", "Mobile only")}</option>
                  <option value="desktop">{text("سطح المكتب فقط", "Desktop only")}</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="rounded-2xl bg-card p-4 hairline sm:p-5">
            <StepTitle
              icon={<MonitorSmartphone />}
              title={text("تفاصيل الطلب", "Request details")}
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label={text("رابط الوجهة — اختياري", "Destination URL — optional")}>
                <input
                  value={destinationUrl}
                  onChange={(event) => setDestinationUrl(event.target.value)}
                  type="url"
                  maxLength={500}
                  placeholder="https://..."
                  className="input min-h-12 w-full"
                />
              </Field>
              <Field label={text("الميزانية التقريبية — اختياري", "Approximate budget — optional")}>
                <input
                  value={budgetNote}
                  onChange={(event) => setBudgetNote(event.target.value)}
                  maxLength={100}
                  placeholder={text(
                    "مثال: أريد عرض السعر المتاح",
                    "Example: send me the available quote",
                  )}
                  className="input min-h-12 w-full"
                />
              </Field>
              <Field
                label={text("ملاحظات أو هدف الحملة — اختياري", "Notes or campaign goal — optional")}
                wide
              >
                <textarea
                  value={customerNote}
                  onChange={(event) => setCustomerNote(event.target.value)}
                  maxLength={900}
                  rows={4}
                  className="input w-full resize-y"
                  placeholder={text(
                    "اكتب أي تفاصيل تساعد فريق رواج على تجهيز العرض المناسب.",
                    "Add any details that help the RAWAJ team prepare the right proposal.",
                  )}
                />
              </Field>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-500/8 p-3 text-[11px] leading-5 text-muted-foreground">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              {text(
                "إرسال الطلب لا يعني شراء الإعلان. السعر وموعد العرض والتصميم والدفع يتم تأكيدها معك قبل التفعيل.",
                "Submitting is not a purchase. Price, schedule, creative, and payment are confirmed with you before activation.",
              )}
            </div>
            <button
              type="submit"
              disabled={saving || loading || !loaded}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50 sm:w-auto"
            >
              <Send className="h-4 w-4" />
              {saving
                ? text("جارٍ إرسال الطلب", "Submitting")
                : text("إرسال طلب الإعلان", "Submit advertising request")}
            </button>
            {notice ? (
              <p
                role="status"
                className="mt-3 rounded-xl bg-muted-surface p-3 text-xs font-semibold leading-6"
              >
                {notice}
              </p>
            ) : null}
          </section>
        </form>

        <RequestHistory requests={requests} loading={loading} loaded={loaded} text={text} />
      </main>
    </>
  );
}

function AdvertisingHero({ text }: { text: (ar: string, en: string) => string }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-amber-400/20 bg-[#17130e] p-5 shadow-soft sm:p-6">
      <div className="flex items-start gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-400/15 text-amber-300">
          <Megaphone className="h-7 w-7" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300/80">
            RAWAJ ADS
          </p>
          <h1 className="mt-1 text-xl font-black text-[#fff7e7] sm:text-2xl">
            {text("احجز مساحة إعلانية أو اطلب حملة", "Request ad space or a campaign")}
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-[#fff7e7]/70 sm:text-sm">
            {text(
              "اختر المكان والمدة وأرسل الطلب. الإدارة تراجع الطلب وتتواصل معك بالسعر ومتطلبات التصميم والدفع قبل أي تفعيل.",
              "Choose placement and duration, then submit. Admin reviews the request and confirms price, creative requirements, and payment before activation.",
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

function RequestHistory({
  requests,
  loading,
  loaded,
  text,
}: {
  requests: AdvertisingRequest[];
  loading: boolean;
  loaded: boolean;
  text: (ar: string, en: string) => string;
}) {
  return (
    <section className="rounded-2xl bg-card p-4 hairline sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-black">
          {text("طلباتك الإعلانية", "Your advertising requests")}
        </h2>
        <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-bold text-foreground">
          {requests.length}
        </span>
      </div>
      {loading && !loaded ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {text("جارٍ التحميل...", "Loading...")}
        </p>
      ) : requests.length ? (
        <div className="mt-3 grid gap-3">
          {requests.map((request) => (
            <article key={request.support.id} className="rounded-xl bg-muted-surface p-3 hairline">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-xs">{kindLabel(request.details.kind, text)}</strong>
                <Status status={request.support.status} text={text} />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {request.details.requestedDays} {text("يوم", "days")} ·{" "}
                {deviceLabel(request.details.device, text)}
              </p>
              {request.support.publicResponse ? (
                <p className="mt-2 rounded-lg bg-card p-2 text-[11px] leading-5 text-foreground hairline">
                  {request.support.publicResponse}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          {text("لا توجد طلبات إعلانية بعد.", "No advertising requests yet.")}
        </p>
      )}
    </section>
  );
}

function StepTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-black">
      <span className="text-amber-500 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      {title}
    </h2>
  );
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "block sm:col-span-2" : "block"}>
      <span className="mb-1.5 block text-xs font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function StatePanel({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-card p-7 text-center hairline">
      <Megaphone className="mx-auto h-7 w-7 text-amber-500" />
      <h1 className="mt-3 text-base font-black">{title}</h1>
      {body ? (
        <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-muted-foreground">{body}</p>
      ) : null}
      {children}
    </section>
  );
}

function kindLabel(kind: AdvertisingRequestKind, text: (ar: string, en: string) => string): string {
  if (kind === "home") return text("مساحة الرئيسية", "Home placement");
  if (kind === "search_results") return text("مساحة نتائج البحث", "Search placement");
  if (kind === "categories") return text("مساحة الأقسام", "Categories placement");
  return text("حملة إعلانية", "Ad campaign");
}

function deviceLabel(
  device: AdvertisingRequestDevice,
  text: (ar: string, en: string) => string,
): string {
  if (device === "mobile") return text("جوال", "Mobile");
  if (device === "desktop") return text("سطح المكتب", "Desktop");
  return text("جوال + سطح المكتب", "Mobile + desktop");
}

function Status({
  status,
  text,
}: {
  status: AdvertisingRequest["support"]["status"];
  text: (ar: string, en: string) => string;
}) {
  const label =
    status === "new"
      ? text("جديد", "New")
      : status === "under_review"
        ? text("قيد المراجعة", "Under review")
        : status === "resolved"
          ? text("تمت المعالجة", "Resolved")
          : text("مغلق", "Closed");
  return (
    <span
      data-status={status}
      className="rawaj-advertise-status rounded-full px-2.5 py-1 text-[10px] font-extrabold"
    >
      {label}
    </span>
  );
}
