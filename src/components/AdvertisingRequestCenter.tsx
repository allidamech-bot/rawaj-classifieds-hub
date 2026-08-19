import { Link } from "@tanstack/react-router";
import {
  BadgePercent,
  CheckCircle2,
  Clock3,
  LayoutTemplate,
  Megaphone,
  Send,
  Target,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { fetchCurrentUserListings } from "@/lib/classifieds-api";
import type { AdPlacementPage } from "@/lib/api/ad-placements";
import {
  ADVERTISING_PLACEMENT_PAGES,
  ADVERTISING_REQUEST_EVENT,
  adminFetchAdvertisingRequests,
  adminUpdateAdvertisingRequest,
  advertisingPlacementLabel,
  advertisingRequestKind,
  consumeAdvertisingRequestIntent,
  createAdvertisingRequest,
  fetchMyAdvertisingRequests,
  openAdvertisingRequest,
  type AdminAdvertisingRequest,
  type AdvertisingRequestIntent,
  type AdvertisingRequestKind,
} from "@/lib/advertising-request";
import type { ClassifiedListing, SupportRequest } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

const REQUEST_DURATIONS = [7, 14, 30] as const;

export function AdvertisingRequestCenter({ pathname }: { pathname: string }) {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const profileId = auth.profile?.id ?? null;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AdvertisingRequestKind>("placement");
  const [placementPage, setPlacementPage] = useState<AdPlacementPage>("home");
  const [listingId, setListingId] = useState("");
  const [requestedDays, setRequestedDays] = useState<number>(7);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState(false);
  const submitInFlightRef = useRef(false);
  const requestGenerationRef = useRef(0);

  const approvedListings = useMemo(
    () => listings.filter((listing) => listing.status === "approved" && !listing.archivedAt),
    [listings],
  );

  const applyIntent = useCallback((intent: AdvertisingRequestIntent | null | undefined) => {
    if (intent?.placementPage) {
      setKind("placement");
      setPlacementPage(intent.placementPage);
    }
    if (intent?.listingId) setListingId(intent.listingId);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AdvertisingRequestIntent>).detail;
      consumeAdvertisingRequestIntent();
      applyIntent(detail);
      setNotice("");
      setSuccess(false);
      setOpen(true);
    };
    window.addEventListener(ADVERTISING_REQUEST_EVENT, handler);

    const url = new URL(window.location.href);
    if (url.searchParams.get("advertise") === "1") {
      applyIntent(consumeAdvertisingRequestIntent());
      setOpen(true);
      url.searchParams.delete("advertise");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }

    return () => window.removeEventListener(ADVERTISING_REQUEST_EVENT, handler);
  }, [applyIntent]);

  const load = useCallback(async () => {
    if (!profileId) return;
    const generation = ++requestGenerationRef.current;
    setLoading(true);
    const [listingsResult, requestsResult] = await Promise.all([
      fetchCurrentUserListings(profileId),
      fetchMyAdvertisingRequests(),
    ]);
    if (generation !== requestGenerationRef.current) return;
    if (listingsResult.ok) setListings(listingsResult.data);
    if (requestsResult.ok) setRequests(requestsResult.data);
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    if (!open || auth.status !== "signedIn" || !profileId) return;
    void load();
    return () => {
      requestGenerationRef.current += 1;
    };
  }, [auth.status, load, open, profileId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, submitting]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInFlightRef.current || auth.status !== "signedIn") return;
    submitInFlightRef.current = true;
    setSubmitting(true);
    setNotice("");
    setSuccess(false);
    try {
      const result = await createAdvertisingRequest({
        kind,
        placementPage: kind === "placement" ? placementPage : null,
        listingId: listingId || null,
        requestedDays,
        destinationUrl,
        budget,
        notes,
      });
      if (!result.ok) {
        setNotice(result.error.message);
        return;
      }
      setSuccess(true);
      setNotice(
        text(
          "تم إرسال طلبك للإدارة. سنراجع المكان والمدة والتكلفة قبل تفعيل أي إعلان.",
          "Your request was sent to the team. Placement, duration, and price will be reviewed before anything goes live.",
        ),
      );
      setNotes("");
      setBudget("");
      setDestinationUrl("");
      await load();
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  }

  const showStoreLauncher = pathname === "/profile/listings";
  const signInHref = (() => {
    const returnTo = `${pathname}?advertise=1`;
    return `/login?returnTo=${encodeURIComponent(returnTo)}`;
  })();

  return (
    <>
      {showStoreLauncher && !open ? (
        <button
          type="button"
          className="rawaj-ad-request-launcher"
          onClick={() => openAdvertisingRequest()}
          aria-label={text("طلب إعلان أو حملة", "Request an ad or campaign")}
        >
          <Megaphone aria-hidden="true" />
          <span>{text("إعلان / حملة", "Ad / Campaign")}</span>
        </button>
      ) : null}

      {open ? (
        <div
          className="rawaj-ad-request-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="rawaj-ad-request-title"
            className="rawaj-ad-request-dialog"
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            <header className="rawaj-ad-request-dialog__header">
              <div>
                <span className="rawaj-ad-request-kicker">
                  <Megaphone aria-hidden="true" />
                  {text("إعلانات رواج", "RAWAJ Advertising")}
                </span>
                <h2 id="rawaj-ad-request-title">
                  {text("اطلب مساحة إعلانية أو حملة", "Request an ad placement or campaign")}
                </h2>
                <p>
                  {text(
                    "اختر أين تريد الظهور أو اطلب حملة كاملة. الطلب يصل للإدارة للمراجعة والتسعير قبل التفعيل.",
                    "Choose where you want to appear or request a full campaign. The team reviews and prices the request before activation.",
                  )}
                </p>
              </div>
              <button
                type="button"
                className="rawaj-ad-request-close"
                onClick={() => !submitting && setOpen(false)}
                aria-label={text("إغلاق", "Close")}
              >
                <X aria-hidden="true" />
              </button>
            </header>

            {auth.status !== "signedIn" ? (
              <div className="rawaj-ad-request-signin">
                <Target aria-hidden="true" />
                <h3>{text("سجّل الدخول لإرسال الطلب", "Sign in to send the request")}</h3>
                <p>
                  {text(
                    "بعد تسجيل الدخول ترجع لنفس الصفحة ويُفتح طلب الإعلان تلقائياً.",
                    "After signing in you will return here and the advertising request will reopen automatically.",
                  )}
                </p>
                <Link
                  to={signInHref}
                  onClick={() => openAdvertisingRequest({ placementPage, listingId })}
                  className="rawaj-ad-request-primary"
                >
                  {text("تسجيل الدخول", "Sign in")}
                </Link>
              </div>
            ) : (
              <form className="rawaj-ad-request-form" onSubmit={(event) => void submit(event)}>
                <fieldset>
                  <legend>{text("نوع الطلب", "Request type")}</legend>
                  <div className="rawaj-ad-request-kind-grid">
                    <button
                      type="button"
                      aria-pressed={kind === "placement"}
                      data-selected={kind === "placement"}
                      onClick={() => setKind("placement")}
                    >
                      <LayoutTemplate aria-hidden="true" />
                      <strong>{text("مساحة إعلانية", "Ad placement")}</strong>
                      <small>{text("الرئيسية، البحث، الأقسام...", "Home, search, categories...")}</small>
                    </button>
                    <button
                      type="button"
                      aria-pressed={kind === "campaign"}
                      data-selected={kind === "campaign"}
                      onClick={() => setKind("campaign")}
                    >
                      <Megaphone aria-hidden="true" />
                      <strong>{text("حملة إعلانية", "Advertising campaign")}</strong>
                      <small>{text("خطة ظهور أوسع يراجعها الفريق", "A broader plan reviewed by the team")}</small>
                    </button>
                  </div>
                </fieldset>

                {kind === "placement" ? (
                  <label>
                    <span>{text("مكان الظهور", "Placement")}</span>
                    <select
                      value={placementPage}
                      onChange={(event) => setPlacementPage(event.target.value as AdPlacementPage)}
                    >
                      {ADVERTISING_PLACEMENT_PAGES.map((page) => (
                        <option key={page} value={page}>
                          {advertisingPlacementLabel(page, text)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label>
                  <span>{text("الإعلان المرتبط (اختياري)", "Related listing (optional)")}</span>
                  <select
                    value={listingId}
                    onChange={(event) => setListingId(event.target.value)}
                    disabled={loading}
                  >
                    <option value="">{text("بدون إعلان محدد", "No specific listing")}</option>
                    {approvedListings.map((listing) => (
                      <option key={listing.id} value={listing.id}>
                        {listing.title}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset>
                  <legend>{text("المدة المطلوبة", "Requested duration")}</legend>
                  <div className="rawaj-ad-request-duration-grid">
                    {REQUEST_DURATIONS.map((days) => (
                      <button
                        key={days}
                        type="button"
                        data-selected={requestedDays === days}
                        aria-pressed={requestedDays === days}
                        onClick={() => setRequestedDays(days)}
                      >
                        <Clock3 aria-hidden="true" />
                        {days} {text("يوم", "days")}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="rawaj-ad-request-two-col">
                  <label>
                    <span>{text("رابط الوجهة (اختياري)", "Destination URL (optional)")}</span>
                    <input
                      value={destinationUrl}
                      onChange={(event) => setDestinationUrl(event.target.value.slice(0, 1000))}
                      type="url"
                      inputMode="url"
                      placeholder="https://"
                    />
                  </label>
                  <label>
                    <span>{text("الميزانية التقريبية (اختياري)", "Approx. budget (optional)")}</span>
                    <input
                      value={budget}
                      onChange={(event) => setBudget(event.target.value.slice(0, 120))}
                      placeholder={text("مثال: أريد عرض سعر", "Example: Please quote me")}
                    />
                  </label>
                </div>

                <label>
                  <span>{text("ملاحظات أو هدف الحملة", "Notes or campaign goal")}</span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value.slice(0, 1200))}
                    rows={3}
                    placeholder={text(
                      "اكتب أي تفاصيل تساعدنا على تجهيز العرض المناسب.",
                      "Add any details that help us prepare the right proposal.",
                    )}
                  />
                </label>

                {notice ? (
                  <p className="rawaj-ad-request-notice" data-success={success} role="status">
                    {success ? <CheckCircle2 aria-hidden="true" /> : <BadgePercent aria-hidden="true" />}
                    {notice}
                  </p>
                ) : null}

                <button type="submit" className="rawaj-ad-request-primary" disabled={submitting}>
                  <Send aria-hidden="true" />
                  {submitting
                    ? text("جارٍ إرسال الطلب...", "Sending request...")
                    : text("إرسال الطلب للإدارة", "Send request to team")}
                </button>

                {requests.length ? (
                  <section className="rawaj-ad-request-history" aria-label={text("طلباتك السابقة", "Previous requests")}>
                    <h3>{text("طلباتك الأخيرة", "Recent requests")}</h3>
                    {requests.slice(0, 4).map((request) => (
                      <article key={request.id}>
                        <strong>
                          {advertisingRequestKind(request) === "campaign"
                            ? text("حملة إعلانية", "Campaign")
                            : text("مساحة إعلانية", "Ad placement")}
                        </strong>
                        <span data-status={request.status}>{supportStatusLabel(request.status, text)}</span>
                        <small>{formatDate(request.createdAt, language)}</small>
                      </article>
                    ))}
                  </section>
                ) : null}
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

export function AdminAdvertisingRequestInbox({ pathname }: { pathname: string }) {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [requests, setRequests] = useState<AdminAdvertisingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const generationRef = useRef(0);

  const load = useCallback(async () => {
    const generation = ++generationRef.current;
    setLoading(true);
    setError("");
    const result = await adminFetchAdvertisingRequests();
    if (generation !== generationRef.current) return;
    setLoading(false);
    if (!result.ok) {
      if (result.error.code !== "permission_denied") setError(result.error.message);
      return;
    }
    setRequests(result.data);
  }, []);

  useEffect(() => {
    if (pathname !== "/admin/promotions" || auth.status !== "signedIn") return;
    void load();
    return () => {
      generationRef.current += 1;
    };
  }, [auth.status, load, pathname]);

  async function setStatus(request: AdminAdvertisingRequest, status: "under_review" | "resolved") {
    if (workingId) return;
    setWorkingId(request.id);
    setError("");
    const result = await adminUpdateAdvertisingRequest({
      id: request.id,
      expectedUpdatedAt: request.updatedAt,
      status,
      priority: request.priority === "urgent" || request.priority === "high" ? request.priority : "normal",
      publicResponse:
        status === "resolved"
          ? text(
              "تمت مراجعة طلب الإعلان من فريق رواج. تم التواصل أو تجهيز الإجراء المطلوب.",
              "Your advertising request was reviewed by the RAWAJ team. The requested action was handled or follow-up was arranged.",
            )
          : null,
      adminNote: status === "under_review" ? "Advertising request under review." : "Advertising request handled.",
    });
    if (!result.ok) setError(result.error.message);
    else await load();
    setWorkingId(null);
  }

  if (pathname !== "/admin/promotions") return null;

  return (
    <section className="rawaj-admin-ad-request-inbox" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="rawaj-admin-ad-request-inbox__heading">
        <div>
          <span>{text("طلبات العملاء", "Customer requests")}</span>
          <h2>{text("المساحات الإعلانية والحملات", "Ad placements & campaigns")}</h2>
          <p>
            {text(
              "الطلبات القادمة من المساحات الإعلانية ومن «متجري». أنشئ التنفيذ الفعلي من مدير المساحات أو الحملات ثم أغلق الطلب.",
              "Requests coming from ad slots and My Store. Create the actual placement or campaign in its manager, then close the request.",
            )}
          </p>
        </div>
        <div className="rawaj-admin-ad-request-inbox__links">
          <Link to="/admin/ad-placements">{text("مدير المساحات", "Placements manager")}</Link>
          <Link to="/admin/campaigns">{text("مدير الحملات", "Campaign manager")}</Link>
        </div>
      </div>

      {loading && !requests.length ? <p>{text("جارٍ تحميل الطلبات...", "Loading requests...")}</p> : null}
      {error ? <p className="rawaj-admin-ad-request-error" role="alert">{error}</p> : null}
      {!loading && !error && requests.length === 0 ? (
        <p className="rawaj-admin-ad-request-empty">{text("لا توجد طلبات إعلانية حالياً.", "No advertising requests right now.")}</p>
      ) : null}

      {requests.length ? (
        <div className="rawaj-admin-ad-request-list">
          {requests.map((request) => (
            <article key={request.id}>
              <div>
                <strong>
                  {advertisingRequestKind(request) === "campaign"
                    ? text("حملة إعلانية", "Advertising campaign")
                    : text("مساحة إعلانية", "Ad placement")}
                </strong>
                <span data-status={request.status}>{supportStatusLabel(request.status, text)}</span>
              </div>
              <pre>{request.message}</pre>
              <small>
                {request.email || request.userId} · {formatDate(request.createdAt, language)}
              </small>
              <div className="rawaj-admin-ad-request-actions">
                {request.status === "new" ? (
                  <button
                    type="button"
                    disabled={workingId !== null}
                    onClick={() => void setStatus(request, "under_review")}
                  >
                    {text("بدء المراجعة", "Start review")}
                  </button>
                ) : null}
                {request.status !== "resolved" && request.status !== "rejected" ? (
                  <button
                    type="button"
                    disabled={workingId !== null}
                    onClick={() => void setStatus(request, "resolved")}
                  >
                    {text("تمت المعالجة", "Mark handled")}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function supportStatusLabel(
  status: SupportRequest["status"],
  text: (ar: string, en: string) => string,
): string {
  if (status === "under_review") return text("قيد المراجعة", "Under review");
  if (status === "resolved") return text("تمت المعالجة", "Handled");
  if (status === "rejected") return text("مغلق", "Closed");
  return text("جديد", "New");
}

function formatDate(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language === "en" ? "en" : "ar", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
