import { createFileRoute, Link } from "@tanstack/react-router";
import { LifeBuoy, Sparkles } from "lucide-react";
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
  ClassifiedsError,
  ListingPromotionRequest,
  PromotionType,
} from "@/lib/classifieds-types";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/promotion")({
  head: () =>
    createSeo({
      title: "طلب ترويج إعلان | RAWAJ / رواج",
      description:
        "اطلب ترويج إعلان معتمد تملكه على رواج. تتم مراجعة طلبات الترويج يدوياً قبل التفعيل.",
      path: "/promotion",
      noindex: true,
    }),
  component: PromotionPage,
});

function PromotionPage() {
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
  const promotionOptions: Array<{ value: PromotionType; label: string; description: string }> = [
    {
      value: "featured_home",
      label: text("الصفحة الرئيسية", "Home page"),
      description: text(
        "مراجعة يدوية للظهور ضمن المساحات المميزة في الرئيسية.",
        "Manual review for featured home placement.",
      ),
    },
    {
      value: "top_category",
      label: text("أعلى القسم", "Top category"),
      description: text(
        "مراجعة يدوية للظهور أعلى نتائج القسم عند توفر المساحة.",
        "Manual review for top category visibility when space is available.",
      ),
    },
    {
      value: "highlighted",
      label: text("إبراز داخل النتائج", "Highlighted in results"),
      description: text(
        "تمييز بصري للإعلان بعد موافقة الإدارة.",
        "Visual highlighting after admin approval.",
      ),
    },
    {
      value: "urgent",
      label: text("موضع مميز", "Priority placement"),
      description: text(
        "طلب أولوية يراجع يدوياً قبل التفعيل.",
        "Priority request reviewed manually before activation.",
      ),
    },
  ];
  const durationOptions = [3, 7, 14, 30];
  const hasPendingForSelectedListing = requests.some(
    (request) => request.listingId === selectedListingId && request.status === "pending_review",
  );

  const loadListings = useCallback(async () => {
    if (!profileId) return;
    const currentProfileId = profileId;
    const requestId = ++listingsRequestIdRef.current;
    setListingsLoading(true);
    setListingsError(null);
    try {
      const result = await fetchCurrentUserListings(currentProfileId);
      if (requestId !== listingsRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
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
      if (requestId !== listingsRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
      setListingsError({
        code: "unknown",
        message: caught instanceof Error ? caught.message : text("تعذر تحميل إعلاناتك.", "Could not load your listings."),
        operation: "promotion_listings_load",
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
      if (requestId !== requestsRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
      if (result.ok) {
        setRequests(result.data);
        setHasLoadedRequests(true);
      } else {
        setRequestsError(result.error);
      }
    } catch (caught) {
      if (requestId !== requestsRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
      setRequestsError({
        code: "unknown",
        message: caught instanceof Error ? caught.message : text("تعذر تحميل طلبات الترويج.", "Could not load promotion requests."),
        operation: "promotion_requests_load",
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
      setNotice(text("انتظر اكتمال تحميل بياناتك قبل الإرسال.", "Wait until your data finishes loading before submitting."));
      return;
    }
    if (!selectedListingId) {
      setNotice(text("اختر إعلاناً معتمداً.", "Choose an approved listing."));
      return;
    }
    if (hasPendingForSelectedListing) {
      setNotice(text("يوجد طلب ترويج قيد المراجعة لهذا الإعلان.", "A promotion request for this listing is already under review."));
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

      setRequests((current) => [result.data, ...current.filter((item) => item.id !== result.data.id)]);
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
              "تم إنشاء طلب الترويج، لكن تعذر رفع الإيصال. لا تعِد إرسال الطلب؛ تواصل مع الدعم لإرفاقه.",
              "The promotion request was created, but the receipt could not upload. Do not resubmit; contact support to attach it.",
            ),
          );
          await loadRequests();
          return;
        }
      }
      setNotice(text("تم إرسال طلب الترويج للمراجعة اليدوية.", "Promotion request sent for manual review."));
      setPaymentMethod("");
      setPaymentReference("");
      setReceiptFile(null);
      await loadRequests();
    } catch (caught) {
      if (currentProfileId === profileIdRef.current) {
        setNotice(caught instanceof Error ? caught.message : text("تعذر إرسال طلب الترويج.", "Could not submit the promotion request."));
      }
    } finally {
      submitInFlightRef.current = false;
      if (currentProfileId === profileIdRef.current) setSaving(false);
    }
  }

  if (auth.status !== "signedIn") {
    return (
      <>
        <PageHeader title={text("ترويج إعلان", "Promote listing")} to="/more" backMode="history" />
        <main className="container-wide mobile-page-bottom pt-4">
          <section className="rounded-2xl bg-card p-8 text-center hairline">
            <Sparkles className="mx-auto h-7 w-7 text-gold" />
            <h2 className="mt-3 text-base font-extrabold">
              {text("تسجيل الدخول مطلوب", "Login required")}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-muted-foreground">
              {text(
                "سجل الدخول لطلب ترويج حقيقي لإعلان معتمد تملكه.",
                "Log in to request real promotion for an approved listing you own.",
              )}
            </p>
            <Link
              to="/login"
              className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
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
      <PageHeader title={text("ترويج إعلان", "Promote listing")} to="/more" backMode="history" />
      <main className="container-wide mobile-page-bottom space-y-5 pt-4">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-soft">
          <h2 className="text-lg font-extrabold">
            {text("طلب ترويج حقيقي", "Real promotion request")}
          </h2>
          <p className="mt-2 text-xs leading-6 text-primary-foreground/80">
            {text(
              "يتم مراجعة طلبات الترويج يدوياً قبل التفعيل. سيتم التواصل معك بخصوص طريقة الدفع المناسبة عند الحاجة.",
              "Promotion requests are reviewed manually before activation. We will contact you about the suitable payment method when needed.",
            )}
          </p>
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
          <>
            {listingsError ? (
              <RecoveryNotice
                title={text("تعذر تحديث إعلاناتك", "Could not refresh your listings")}
                body={listingsError.message}
                actionLabel={text("إعادة المحاولة", "Try again")}
                onAction={() => void loadListings()}
                actionDisabled={listingsLoading}
              />
            ) : null}
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
          </>
        ) : (
          <>
            {listingsError ? (
              <RecoveryNotice
                title={text("تعذر تحديث إعلاناتك", "Could not refresh your listings")}
                body={listingsError.message}
                actionLabel={text("إعادة المحاولة", "Try again")}
                onAction={() => void loadListings()}
                actionDisabled={listingsLoading}
              />
            ) : null}
            <form
              onSubmit={(event) => void submit(event)}
              aria-busy={saving}
              className="rounded-2xl bg-card p-4 hairline"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={text("الإعلان", "Listing")}>
                  <select
                    value={selectedListingId}
                    onChange={(event) => setSelectedListingId(event.target.value)}
                    className="input"
                  >
                    {approvedListings.map((listing) => (
                      <option key={listing.id} value={listing.id}>
                        {listing.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={text("موضع الترويج", "Promotion placement")}>
                  <select
                    value={promotionType}
                    onChange={(event) => setPromotionType(event.target.value as PromotionType)}
                    className="input"
                  >
                    {promotionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                    {promotionOptions.find((option) => option.value === promotionType)?.description}
                  </p>
                </Field>
                <Field label={text("المدة", "Duration")}>
                  <select
                    value={requestedDays}
                    onChange={(event) => setRequestedDays(Number(event.target.value))}
                    className="input"
                  >
                    {durationOptions.map((days) => (
                      <option key={days} value={days}>
                        {text(`${days} أيام`, `${days} days`)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={text("طريقة دفع مرجعية اختيارية", "Optional payment method note")}>
                  <input
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    maxLength={80}
                    className="input"
                  />
                </Field>
                <Field label={text("مرجع دفع اختياري", "Optional payment reference")}>
                  <input
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    maxLength={160}
                    className="input"
                  />
                </Field>
                <Field label={text("إيصال التحويل", "Transfer receipt")}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
                    className="input"
                  />
                  {receiptFile && (
                    <p className="mt-1 text-[11px] text-muted-foreground">{receiptFile.name}</p>
                  )}
                </Field>
              </div>
              <div className="mt-4 rounded-xl bg-muted-surface p-3 text-xs leading-6 text-foreground hairline">
                {text(
                  "يتم مراجعة طلبات الترويج يدوياً قبل التفعيل. سيتم التواصل معك بخصوص طريقة الدفع المناسبة عند الحاجة، ويصبح الإعلان مميزاً بعد موافقة الإدارة.",
                  "Promotion requests are reviewed manually before activation. We will contact you about the suitable payment method when needed, and the listing becomes featured after admin approval.",
                )}
              </div>
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
                className="mt-3 rounded-xl bg-gold px-4 py-2 text-xs font-bold text-gold-foreground disabled:opacity-60"
              >
                {saving
                  ? text("جارٍ الإرسال", "Sending")
                  : text("إرسال طلب الترويج", "Request promotion")}
              </button>
              {notice && (
                <p className="mt-3 rounded-xl bg-muted-surface p-3 text-xs font-semibold">
                  {notice}
                </p>
              )}
            </form>
          </>
        )}

        <section className="rounded-2xl bg-card p-4 hairline">
          <h3 className="text-sm font-extrabold">{text("طلباتك", "Your requests")}</h3>
          {requestsLoading && !hasLoadedRequests ? (
            <p className="mt-2 text-xs text-muted-foreground">
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
              {requests.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {text("لا توجد طلبات ترويج بعد.", "No promotion requests yet.")}
                </p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-xl bg-muted-surface p-3 text-xs hairline"
                    >
                      <p className="font-bold">{request.listingTitle ?? request.listingId}</p>
                      <p className="mt-1 text-muted-foreground">
                        {promotionStatusLabel(request.status, text)} ·{" "}
                        {promotionTypeLabel(request.promotionType, text)} · {request.requestedDays}{" "}
                        {text("يوم", "days")}
                      </p>
                      {request.adminNote && (
                        <p className="mt-1 text-muted-foreground">{request.adminNote}</p>
                      )}
                    </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Panel({
  title,
  body,
  actionLabel,
  onAction,
  actionDisabled,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}) {
  return (
    <section className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
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
  if (type === "top_category") return text("أعلى القسم", "Top category");
  if (type === "highlighted") return text("إبراز داخل النتائج", "Highlighted in results");
  if (type === "urgent") return text("موضع مميز", "Priority placement");
  return text("الصفحة الرئيسية", "Home page");
}
