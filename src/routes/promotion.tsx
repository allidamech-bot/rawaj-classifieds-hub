import { createFileRoute, Link } from "@tanstack/react-router";
import { LifeBuoy, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  createListingPromotionRequest,
  fetchCurrentUserListings,
  fetchMyPromotionRequests,
} from "@/lib/classifieds-api";
import type {
  ClassifiedListing,
  ClassifiedsError,
  ListingPromotionRequest,
  PromotionType,
} from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/promotion")({
  head: () => ({ meta: [{ title: "ترويج إعلان | رواج" }] }),
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
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const approvedListings = useMemo(
    () => listings.filter((listing) => listing.status === "approved"),
    [listings],
  );

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
    setSaving(false);
    if (result.ok) {
      setNotice(text("تم إرسال طلب الترويج للمراجعة.", "Promotion request sent for review."));
      setPaymentMethod("");
      setPaymentReference("");
      await load();
    } else {
      setNotice(result.error.message);
    }
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
              "يُنشأ الطلب كقيد مراجعة. لا توجد معالجة دفع آلية أو نجاح دفع وهمي في هذه المرحلة.",
              "The request is stored as pending review. There is no automatic payment processing or fake payment success in this stage.",
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
              <Field label={text("نوع الترويج", "Promotion type")}>
                <select
                  value={promotionType}
                  onChange={(event) => setPromotionType(event.target.value as PromotionType)}
                  className="input"
                >
                  <option value="featured_home">{text("تمييز رئيسي", "Featured home")}</option>
                  <option value="highlighted">{text("إبراز", "Highlighted")}</option>
                  <option value="urgent">{text("عاجل", "Urgent")}</option>
                  <option value="top_category">{text("أعلى القسم", "Top category")}</option>
                </select>
              </Field>
              <Field label={text("المدة بالأيام", "Duration in days")}>
                <input
                  value={requestedDays}
                  onChange={(event) => setRequestedDays(Number(event.target.value))}
                  type="number"
                  min={1}
                  max={90}
                  className="input"
                />
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
      <style>{`.input{width:100%;border-radius:.75rem;background:var(--muted-surface);border:1px solid var(--border);padding:.625rem .75rem;font-size:.875rem;color:var(--foreground);outline:none}.input:focus{border-color:var(--ring)}`}</style>
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
