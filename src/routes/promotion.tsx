import { createFileRoute } from "@tanstack/react-router";
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
  const [plan, setPlan] = useState(7);
  const [listingId, setListingId] = useState("");
  const [listingTitle, setListingTitle] = useState("");
  const [promoType, setPromoType] = useState("شارة (مميز)");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("SYP");
  const [notes, setNotes] = useState("");

  return (
    <>
      <PageHeader title="ترويج إعلان" />
      <main className="container-wide pt-4 pb-8 space-y-5">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-soft">
          <h2 className="text-lg font-extrabold">روّج إعلانك ليصل لأكبر عدد من المشترين</h2>
          <p className="mt-1 text-xs text-primary-foreground/80">
            خدمات الترويج اختيارية ومدفوعة. حالياً النظام في وضع المعاينة فقط ولم يتم تفعيل أي دفع.
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
                  <h3 className="text-sm font-extrabold">{b.t}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{b.d}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Plans */}
        <section>
          <h3 className="mb-3 text-sm font-extrabold">اختر مدة الترويج</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {plans.map((p) => {
              const active = plan === p.days;
              return (
                <button
                  key={p.days}
                  onClick={() => setPlan(p.days)}
                  className={`rounded-2xl p-4 text-center hairline transition ${active ? "bg-gold text-gold-foreground shadow-premium" : "bg-card hover:bg-muted-surface"}`}
                >
                  <div className="text-base font-extrabold">{p.label}</div>
                  <div className="mt-1 text-[11px] opacity-80">{p.desc}</div>
                  <div className="mt-2 text-[10px] font-bold">السعر: قريباً</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Request form */}
        <section>
          <h3 className="mb-3 text-sm font-extrabold">تفاصيل طلب الترويج</h3>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="grid grid-cols-1 gap-3 rounded-2xl bg-card p-4 hairline sm:grid-cols-2"
          >
            <Field label="رقم الإعلان">
              <input
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
                placeholder="مثال: 12"
                className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="عنوان الإعلان">
              <input
                value={listingTitle}
                onChange={(e) => setListingTitle(e.target.value)}
                placeholder="عنوان مختصر"
                className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="نوع الترويج">
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
            <Field label="مدة الترويج">
              <input
                readOnly
                value={`${plan} يوم`}
                className="w-full rounded-xl border border-input bg-muted-surface px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="المبلغ">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                inputMode="numeric"
                placeholder="0"
                className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="العملة">
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
              <Field label="ملاحظات للطلب">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
                  placeholder="أي ملاحظات تخص طلب الترويج"
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
              <p className="text-sm font-bold">تفاصيل الدفع البنكي — نموذج تجريبي غير مفعّل</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                لا يوجد حساب بنكي فعلي للتحويل حالياً. هذه الحقول لعرض الشكل المستقبلي فقط، ولن يتم
                حفظ أو إرسال أي بيانات.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="اسم صاحب الحساب">
              <input
                disabled
                placeholder="—"
                className="w-full rounded-xl border border-input bg-muted-surface px-3 py-2.5 text-sm cursor-not-allowed"
              />
            </Field>
            <Field label="اسم البنك">
              <input
                disabled
                placeholder="—"
                className="w-full rounded-xl border border-input bg-muted-surface px-3 py-2.5 text-sm cursor-not-allowed"
              />
            </Field>
            <Field label="رقم العملية / مرجع التحويل">
              <input
                disabled
                placeholder="—"
                className="w-full rounded-xl border border-input bg-muted-surface px-3 py-2.5 text-sm cursor-not-allowed"
              />
            </Field>
            <Field label="المبلغ المحوّل">
              <input
                disabled
                placeholder="—"
                className="w-full rounded-xl border border-input bg-muted-surface px-3 py-2.5 text-sm cursor-not-allowed"
              />
            </Field>
            <Field label="العملة">
              <input
                disabled
                placeholder="—"
                className="w-full rounded-xl border border-input bg-muted-surface px-3 py-2.5 text-sm cursor-not-allowed"
              />
            </Field>
            <Field label="تاريخ التحويل">
              <input
                disabled
                placeholder="—"
                className="w-full rounded-xl border border-input bg-muted-surface px-3 py-2.5 text-sm cursor-not-allowed"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="إثبات التحويل">
                <button
                  disabled
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card-warm py-4 text-xs text-muted-foreground cursor-not-allowed"
                >
                  <Upload className="h-4 w-4" /> رفع صورة الإيصال · قريباً
                </button>
              </Field>
            </div>
            <Field label="حالة الطلب">
              <input
                disabled
                value="بانتظار التفعيل"
                className="w-full rounded-xl border border-input bg-muted-surface px-3 py-2.5 text-sm cursor-not-allowed"
              />
            </Field>
          </div>
        </section>

        <button
          disabled
          title="سيُفعَّل لاحقاً"
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground opacity-80 cursor-not-allowed"
        >
          <Lock className="h-4 w-4" /> إرسال طلب الترويج · قريباً
        </button>
        <p className="text-center text-[11px] text-muted-foreground">
          لن يتم تنفيذ أي عملية دفع أو تحويل بنكي ضمن النسخة التجريبية الحالية.
        </p>
      </main>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
