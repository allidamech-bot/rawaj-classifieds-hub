import { createFileRoute, Link } from "@tanstack/react-router";
import { LifeBuoy, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [requests, setRequests] = useState<ListingPromotionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [promotionType, setPromotionType] = useState<PromotionType>("featured_home");
  const [requestedDays, setRequestedDays] = useState(7);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

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

  async function load() {
    if (!auth.profile?.id) return;
    setLoading(true);
    setError(null);
    const [listingsResult, requestsResult] = await Promise.all([
      fetchCurrentUserListings(auth.profile.id),
      fetchMyPromotionRequests(auth.profile.id),
    ]);
    if (listingsResult.ok) {
      setListings(listingsResult.data);
      setSelectedListingId(
        (current) =>
          current || listingsResult.data.find((item) => item.status === "approved")?.id || "",
      );
    } else {
      setError(listingsResult.error);
    }
    if (requestsResult.ok) setRequests(requestsResult.data);
    else setError(requestsResult.error);
    setLoading(false);
  }

  useEffect(() => {
    if (auth.status !== "signedIn") return;
    void load();
  }, [auth.status, auth.profile?.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setSaving(true);
    const result = await createListingPromotionRequest({
      listingId: selectedListingId,
      requesterUserId: auth.profile?.id ?? null,
      promotionType,
      requestedDays,
      paymentMethod: paymentMethod || null,
      paymentReference: paymentReference || null,
    });
    if (result.ok) {
      if (receiptFile) {
        const receiptResult = await uploadPromotionReceipt({
          userId: auth.profile?.id ?? null,
          requestId: result.data.id,
          file: receiptFile,
        });
        if (!receiptResult.ok) {
          setSaving(false);
          setNotice(
            text(
              `تم إرسال طلب الترويج للمراجعة، لكن تعذر رفع الإيصال: ${receiptResult.error.message}`,
              `Promotion request was sent for review, but receipt upload failed: ${receiptResult.error.message}`,
            ),
          );
          await load();
          return;
        }
      }
      setNotice(
        text("تم إرسال طلب الترويج للمراجعة اليدوية.", "Promotion request sent for manual review."),
      );
      setPaymentMethod("");
      setPaymentReference("");
      setReceiptFile(null);
      await load();
    } else {
      setNotice(result.error.message);
    }
    setSaving(false);
  }

  if (auth.status !== "signedIn") {
    return (
      <>
        <PageHeader title={text("ترويج إعلان", "Promote listing")} />
        <main className="container-wide pt-4 pb-8">
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
      <PageHeader title={text("ترويج إعلان", "Promote listing")} />
      <main className="container-wide space-y-5 pt-4 pb-8">
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

        {loading ? (
          <Panel title={text("جارٍ تحميل بيانات الترويج", "Loading promotion data")} />
        ) : error ? (
          <Panel
            title={text("تعذر تحميل بيانات الترويج", "Could not load promotion data")}
            body={error.message}
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
              disabled={saving || !selectedListingId}
              className="mt-3 rounded-xl bg-gold px-4 py-2 text-xs font-bold text-gold-foreground disabled:opacity-60"
            >
              {saving
                ? text("جارٍ الإرسال", "Sending")
                : text("إرسال طلب الترويج", "Request promotion")}
            </button>
            {notice && (
              <p className="mt-3 rounded-xl bg-muted-surface p-3 text-xs font-semibold">{notice}</p>
            )}
          </form>
        )}

        <section className="rounded-2xl bg-card p-4 hairline">
          <h3 className="text-sm font-extrabold">{text("طلباتك", "Your requests")}</h3>
          {requests.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {text("لا توجد طلبات ترويج بعد.", "No promotion requests yet.")}
            </p>
          ) : (
            <div className="mt-3 grid gap-2">
              {requests.map((request) => (
                <div key={request.id} className="rounded-xl bg-muted-surface p-3 text-xs hairline">
                  <p className="font-bold">{request.listingTitle ?? request.listingId}</p>
                  <p className="mt-1 text-muted-foreground">
                    {request.status} · {request.promotionType} · {request.requestedDays}{" "}
                    {text("يوم", "days")}
                  </p>
                  {request.adminNote && (
                    <p className="mt-1 text-muted-foreground">{request.adminNote}</p>
                  )}
                </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
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
