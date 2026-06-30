import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sparkles,
  TrendingUp,
  Home as HomeIcon,
  LayoutTemplate,
  Lock,
  Upload,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";

export const Route = createFileRoute("/promotion")({
  head: () => ({ meta: [{ title: "ترويج إعلان | رَوَاج" }] }),
  component: PromotionPage,
});

const benefits = [
  { icon: Sparkles, t: "شارة (مميز)", d: "إطار ذهبي وشارة مميزة على بطاقة إعلانك." },
  { icon: TrendingUp, t: "ظهور أعلى النتائج", d: "تثبيت إعلانك أعلى نتائج القسم أو المحافظة." },
  { icon: HomeIcon, t: "ظهور في الرئيسية", d: "عرض إعلانك ضمن قسم الإعلانات المميزة." },
  {
    icon: LayoutTemplate,
    t: "إعادة رفع تلقائي",
    d: "رفع إعلانك إلى الأعلى دورياً خلال فترة الترويج.",
  },
];

const plans = [
  { days: 3, label: "3 أيام", desc: "تجربة سريعة" },
  { days: 7, label: "7 أيام", desc: "الأكثر شيوعاً" },
  { days: 14, label: "14 يوم", desc: "ظهور موسّع" },
  { days: 30, label: "30 يوم", desc: "حملة كاملة" },
];

function PromotionPage() {
  const { language, text } = useUiPreferences();
  const [plan, setPlan] = useState(7);
  const [listingId, setListingId] = useState("");
  const [listingTitle, setListingTitle] = useState("");
  const [promoType, setPromoType] = useState("شارة (مميز)");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("SYP");
  const [notes, setNotes] = useState("");

  return (
    <>
      <PageHeader title={text("ترويج إعلان", "Promote listing")} />
      <main className="container-wide pt-4 pb-8 space-y-5">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-soft">
          <h2 className="text-lg font-extrabold">
            {text(
              "روّج إعلانك ليصل لأكبر عدد من المشترين",
              "Promote your listing to reach more buyers",
            )}
          </h2>
          <p className="mt-1 text-xs text-primary-foreground/80">
            {text(
              "خدمات الترويج اختيارية ومدفوعة. حالياً النظام في وضع المعاينة فقط ولم يتم تفعيل أي دفع.",
              "Promotion services are optional and paid. The system is preview-only now, with no payment enabled.",
            )}
          </p>
        </section>

        {/* Benefits */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {benefits.map((b) => (
            <div key={b.t} className="rounded-2xl bg-card p-4 hairline shadow-soft">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold">
                  <b.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold">{promoText(b.t, language)}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{promoText(b.d, language)}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Plans */}
        <section>
          <h3 className="mb-3 text-sm font-extrabold">
            {text("اختر مدة الترويج", "Choose promotion duration")}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {plans.map((p) => {
              const active = plan === p.days;
              return (
                <button
                  key={p.days}
                  onClick={() => setPlan(p.days)}
                  className={`rounded-2xl p-4 text-center hairline transition ${active ? "bg-gold text-gold-foreground shadow-premium" : "bg-card hover:bg-muted-surface"}`}
                >
                  <div className="text-base font-extrabold">{promoText(p.label, language)}</div>
                  <div className="mt-1 text-[11px] opacity-80">{promoText(p.desc, language)}</div>
                  <div className="mt-2 text-[10px] font-bold">
                    {text("السعر: قريباً", "Price: soon")}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Request form */}
        <section>
          <h3 className="mb-3 text-sm font-extrabold">
            {text("تفاصيل طلب الترويج", "Promotion request details")}
          </h3>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="grid grid-cols-1 gap-3 rounded-2xl bg-card p-4 hairline sm:grid-cols-2"
          >
            <Field label={text("رقم الإعلان", "Listing ID")}>
              <input
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
                placeholder={text("مثال: 12", "Example: 12")}
                className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label={text("عنوان الإعلان", "Listing title")}>
              <input
                value={listingTitle}
                onChange={(e) => setListingTitle(e.target.value)}
                placeholder={text("عنوان مختصر", "Short title")}
                className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label={text("نوع الترويج", "Promotion type")}>
              <select
                value={promoType}
                onChange={(e) => setPromoType(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
              >
                <option>شارة (مميز)</option>
                <option>ظهور أعلى النتائج</option>
                <option>ظهور في الرئيسية</option>
                <option>إعادة رفع تلقائي</option>
              </select>
            </Field>
            <Field label={text("مدة الترويج", "Promotion duration")}>
              <input
                readOnly
                value={text(`${plan} يوم`, `${plan} days`)}
                className="w-full rounded-xl border border-input bg-muted-surface px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label={text("المبلغ", "Amount")}>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                inputMode="numeric"
                placeholder="0"
                className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label={text("العملة", "Currency")}>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
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
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
                  placeholder={text(
                    "أي ملاحظات تخص طلب الترويج",
                    "Any notes about this promotion request",
                  )}
                />
              </Field>
            </div>
          </form>
        </section>

        {/* Bank/payment placeholder */}
        <section className="rounded-2xl bg-warning/10 p-4 hairline">
          <div className="mb-2 flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-bold">
                {text(
                  "تفاصيل الدفع البنكي — نموذج تجريبي غير مفعّل",
                  "Bank payment details - disabled demo",
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {text(
                  "لا يوجد حساب بنكي فعلي للتحويل حالياً. هذه الحقول لعرض الشكل المستقبلي فقط، ولن يتم حفظ أو إرسال أي بيانات.",
                  "There is no active bank account for transfer now. These fields preview the future shape only, and no data is saved or sent.",
                )}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={text("اسم صاحب الحساب", "Account holder")}>
              <input
                disabled
                placeholder="—"
                className="w-full rounded-xl border border-input bg-muted-surface px-3 py-2.5 text-sm cursor-not-allowed"
              />
            </Field>
            <Field label={text("اسم البنك", "Bank name")}>
              <input
                disabled
                placeholder="—"
                className="w-full rounded-xl border border-input bg-muted-surface px-3 py-2.5 text-sm cursor-not-allowed"
              />
            </Field>
            <Field label={text("رقم العملية / مرجع التحويل", "Transaction/reference number")}>
              <input
                disabled
                placeholder="—"
                className="w-full rounded-xl border border-input bg-muted-surface px-3 py-2.5 text-sm cursor-not-allowed"
              />
            </Field>
            <Field label={text("المبلغ المحوّل", "Transferred amount")}>
              <input
                disabled
                placeholder="—"
                className="w-full rounded-xl border border-input bg-muted-surface px-3 py-2.5 text-sm cursor-not-allowed"
              />
            </Field>
            <Field label={text("العملة", "Currency")}>
              <input
                disabled
                placeholder="—"
                className="w-full rounded-xl border border-input bg-muted-surface px-3 py-2.5 text-sm cursor-not-allowed"
              />
            </Field>
            <Field label={text("تاريخ التحويل", "Transfer date")}>
              <input
                disabled
                placeholder="—"
                className="w-full rounded-xl border border-input bg-muted-surface px-3 py-2.5 text-sm cursor-not-allowed"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label={text("إثبات التحويل", "Transfer proof")}>
                <button
                  disabled
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card-warm py-4 text-xs text-muted-foreground cursor-not-allowed"
                >
                  <Upload className="h-4 w-4" />{" "}
                  {text("رفع صورة الإيصال · قريباً", "Upload receipt · soon")}
                </button>
              </Field>
            </div>
            <Field label={text("حالة الطلب", "Request status")}>
              <input
                disabled
                value={text("بانتظار التفعيل", "Awaiting activation")}
                className="w-full rounded-xl border border-input bg-muted-surface px-3 py-2.5 text-sm cursor-not-allowed"
              />
            </Field>
          </div>
        </section>

        <button
          disabled
          title={text("سيُفعَّل لاحقاً", "Will be enabled later")}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground opacity-80 cursor-not-allowed"
        >
          <Lock className="h-4 w-4" />{" "}
          {text("إرسال طلب الترويج · قريباً", "Submit promotion request · soon")}
        </button>
        <p className="text-center text-[11px] text-muted-foreground">
          {text(
            "لن يتم تنفيذ أي عملية دفع أو تحويل بنكي ضمن النسخة التجريبية الحالية.",
            "No payment or bank transfer will be executed in the current beta.",
          )}
        </p>
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
    "شارة (مميز)": "Featured badge",
    "إطار ذهبي وشارة مميزة على بطاقة إعلانك.":
      "Gold treatment and a featured badge on your listing card.",
    "ظهور أعلى النتائج": "Top results placement",
    "تثبيت إعلانك أعلى نتائج القسم أو المحافظة.":
      "Pin your listing near the top of category or governorate results.",
    "ظهور في الرئيسية": "Home page placement",
    "عرض إعلانك ضمن قسم الإعلانات المميزة.": "Show your listing in the featured listings area.",
    "إعادة رفع تلقائي": "Automatic bump",
    "رفع إعلانك إلى الأعلى دورياً خلال فترة الترويج.":
      "Move your listing upward periodically during the promotion period.",
    "3 أيام": "3 days",
    "7 أيام": "7 days",
    "14 يوم": "14 days",
    "30 يوم": "30 days",
    "تجربة سريعة": "Quick trial",
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
