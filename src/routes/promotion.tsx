import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Home as HomeIcon,
  LayoutTemplate,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";

export const Route = createFileRoute("/promotion")({
  head: () => ({ meta: [{ title: "ترويج إعلان | رَوَاج" }] }),
  component: PromotionPage,
});

const benefits = [
  { icon: Sparkles, t: "شارة مميز", d: "إطار ذهبي وشارة واضحة على بطاقة إعلانك." },
  {
    icon: TrendingUp,
    t: "ظهور أعلى النتائج",
    d: "إبراز الإعلان ضمن نتائج القسم أو المحافظة المختارة.",
  },
  {
    icon: HomeIcon,
    t: "ظهور في الرئيسية",
    d: "عرض الإعلان ضمن مساحة الإعلانات المميزة في الواجهة.",
  },
  { icon: LayoutTemplate, t: "إعادة رفع دورية", d: "تحسين إيقاع ظهور الإعلان خلال مدة الترويج." },
];

const plans = [
  { days: 3, label: "3 أيام", desc: "تجربة سريعة", price: "25,000 ل.س" },
  { days: 7, label: "7 أيام", desc: "الأكثر شيوعاً", price: "50,000 ل.س" },
  { days: 14, label: "14 يوم", desc: "ظهور موسّع", price: "90,000 ل.س" },
  { days: 30, label: "30 يوم", desc: "حملة كاملة", price: "160,000 ل.س" },
];

function PromotionPage() {
  const { language, text } = useUiPreferences();
  const [plan, setPlan] = useState(7);
  const [listingId, setListingId] = useState("");
  const [listingTitle, setListingTitle] = useState("");
  const [promoType, setPromoType] = useState("شارة مميز");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("SYP");
  const [notes, setNotes] = useState("");
  const [receiptReady, setReceiptReady] = useState(false);
  const [requestRef, setRequestRef] = useState("");

  const selectedPlan = useMemo(() => plans.find((item) => item.days === plan) ?? plans[1], [plan]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setRequestRef(`PR-${Date.now().toString().slice(-6)}`);
  }

  return (
    <>
      <PageHeader title={text("ترويج إعلان", "Promote listing")} />
      <main className="container-wide pt-4 pb-8 space-y-5">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-soft">
          <h2 className="text-lg font-extrabold">
            {text(
              "روّج إعلانك ليصل إلى عدد أكبر من المشترين",
              "Promote your listing to reach more buyers",
            )}
          </h2>
          <p className="mt-1 text-xs leading-6 text-primary-foreground/80">
            {text(
              "اختر نوع الظهور والمدة، ثم جهّز طلب الترويج للمراجعة اليدوية. لا تتم أي عملية دفع تلقائية داخل رَوَاج.",
              "Choose placement and duration, then prepare the request for manual review. RAWAJ does not execute automatic payments.",
            )}
          </p>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {benefits.map((benefit) => (
            <div key={benefit.t} className="rounded-2xl bg-card p-4 hairline shadow-soft">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold">
                  <benefit.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold">{promoText(benefit.t, language)}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {promoText(benefit.d, language)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section>
          <h3 className="mb-3 text-sm font-extrabold">
            {text("اختر مدة الترويج", "Choose promotion duration")}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {plans.map((item) => {
              const active = plan === item.days;
              return (
                <button
                  key={item.days}
                  type="button"
                  onClick={() => setPlan(item.days)}
                  className={`rounded-2xl p-4 text-center hairline transition ${
                    active
                      ? "bg-gold text-gold-foreground shadow-premium"
                      : "bg-card hover:bg-muted-surface"
                  }`}
                >
                  <div className="text-base font-extrabold">{promoText(item.label, language)}</div>
                  <div className="mt-1 text-[11px] opacity-80">
                    {promoText(item.desc, language)}
                  </div>
                  <div className="mt-2 text-[11px] font-bold">{item.price}</div>
                </button>
              );
            })}
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-5">
          <section>
            <h3 className="mb-3 text-sm font-extrabold">
              {text("تفاصيل طلب الترويج", "Promotion request details")}
            </h3>
            <div className="grid grid-cols-1 gap-3 rounded-2xl bg-card p-4 hairline sm:grid-cols-2">
              <Field label={text("رقم الإعلان", "Listing ID")}>
                <input
                  value={listingId}
                  onChange={(event) => setListingId(event.target.value)}
                  placeholder={text("مثال: 12", "Example: 12")}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
                />
              </Field>
              <Field label={text("عنوان الإعلان", "Listing title")}>
                <input
                  value={listingTitle}
                  onChange={(event) => setListingTitle(event.target.value)}
                  placeholder={text("عنوان مختصر", "Short title")}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
                />
              </Field>
              <Field label={text("نوع الترويج", "Promotion type")}>
                <select
                  value={promoType}
                  onChange={(event) => setPromoType(event.target.value)}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
                >
                  {benefits.map((item) => (
                    <option key={item.t} value={item.t}>
                      {promoText(item.t, language)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={text("مدة الترويج", "Promotion duration")}>
                <input
                  readOnly
                  value={language === "ar" ? selectedPlan.label : `${selectedPlan.days} days`}
                  className="w-full rounded-xl border border-input bg-muted-surface px-3 py-2.5 text-sm"
                />
              </Field>
              <Field label={text("المبلغ المتوقع", "Expected amount")}>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="numeric"
                  placeholder={selectedPlan.price}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
                />
              </Field>
              <Field label={text("العملة", "Currency")}>
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
                >
                  <option value="SYP">ل.س</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label={text("ملاحظات للطلب", "Request notes")}>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
                    placeholder={text(
                      "أي ملاحظات تخص طلب الترويج",
                      "Any notes about this promotion request",
                    )}
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-warning/10 p-4 hairline">
            <div className="mb-3 flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-bold">
                  {text("الدفع والمراجعة اليدوية", "Payment and manual review")}
                </p>
                <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                  {text(
                    "لا يوجد دفع تلقائي داخل هذه الصفحة. يمكنك تجهيز طلب الترويج، وسيتم تأكيد أي تحويل أو إثبات دفع خارجياً قبل تفعيل الإعلان المميز.",
                    "There is no automatic payment on this page. You can prepare the request, and any transfer or proof of payment must be confirmed externally before featuring is activated.",
                  )}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={text("اسم صاحب الحساب", "Account holder")}>
                <input
                  placeholder={text("يُحدَّد عند المراجعة", "Provided during review")}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
                />
              </Field>
              <Field label={text("مرجع التحويل", "Transfer reference")}>
                <input
                  placeholder={text("اختياري", "Optional")}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
                />
              </Field>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setReceiptReady(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card-warm py-4 text-xs font-bold text-muted-foreground"
                >
                  <Upload className="h-4 w-4" />
                  {text("إضافة ملاحظة لإثبات الدفع", "Add proof-of-payment note")}
                </button>
                {receiptReady && (
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-trust">
                    <CheckCircle className="h-3 w-3" />
                    {text("تم تجهيز ملاحظة الإثبات للمراجعة", "Proof note prepared for review")}
                  </p>
                )}
              </div>
            </div>
          </section>

          <button
            type="submit"
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
          >
            {text("إرسال طلب الترويج للمراجعة", "Submit promotion request for review")}
          </button>
          {requestRef && (
            <div className="rounded-xl bg-emerald-trust/10 p-3 text-center text-xs leading-6 text-emerald-trust">
              <strong>{text("تم تجهيز طلب الترويج", "Promotion request prepared")}</strong>
              <span className="mx-1">·</span>
              {text("رقم المتابعة", "Reference")} {requestRef}.{" "}
              {text(
                "هذه حالة واجهة محلية ولا تعني تنفيذ دفع أو تفعيل إعلان مميز.",
                "This is a local interface state and does not mean payment was executed or featuring was activated.",
              )}
            </div>
          )}
        </form>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link
            to="/add-listing"
            className="rounded-xl bg-gold px-4 py-2.5 text-center text-sm font-bold text-gold-foreground"
          >
            {text("أضف إعلاناً أولاً", "Post a listing first")}
          </Link>
          <Link
            to="/listings"
            className="rounded-xl bg-card px-4 py-2.5 text-center text-sm font-bold hairline"
          >
            {text("تصفح الإعلانات", "Browse listings")}
          </Link>
        </div>
      </main>
    </>
  );
}

function promoText(value: string, language: Language) {
  if (language === "ar") return value;
  const labels: Record<string, string> = {
    "شارة مميز": "Featured badge",
    "إطار ذهبي وشارة واضحة على بطاقة إعلانك.":
      "Gold treatment and a clear featured badge on your listing card.",
    "ظهور أعلى النتائج": "Top results placement",
    "إبراز الإعلان ضمن نتائج القسم أو المحافظة المختارة.":
      "Highlight the listing in selected category or governorate results.",
    "ظهور في الرئيسية": "Home page placement",
    "عرض الإعلان ضمن مساحة الإعلانات المميزة في الواجهة.":
      "Show the listing in the featured area on the home page.",
    "إعادة رفع دورية": "Periodic bump",
    "تحسين إيقاع ظهور الإعلان خلال مدة الترويج.":
      "Improve listing visibility rhythm during the promotion period.",
    "3 أيام": "3 days",
    "7 أيام": "7 days",
    "14 يوم": "14 days",
    "30 يوم": "30 days",
    "تجربة سريعة": "Quick run",
    "الأكثر شيوعاً": "Most common",
    "ظهور موسّع": "Extended visibility",
    "حملة كاملة": "Full campaign",
  };
  return labels[value] ?? value;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
