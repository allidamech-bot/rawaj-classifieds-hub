import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { LifeBuoy, ChevronDown, ShieldAlert, Paperclip } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [{ title: "الدعم | رَوَاج" }] }),
  component: SupportPage,
});

const types = [
  "مشكلة في إعلان",
  "مشكلة في حساب",
  "بلاغ عن احتيال",
  "طلب توثيق",
  "طلب ترويج",
  "مشكلة تقنية",
  "اقتراح أو ملاحظة",
];

const helpTopics = [
  { title: "مشكلة في إعلان", desc: "إعلان مخالف، صور غير صحيحة، أو معلومات مضللة." },
  { title: "مشكلة في حساب", desc: "تسجيل الدخول، تحديث البيانات، أو حذف الحساب." },
  { title: "بلاغ عن احتيال", desc: "محاولة احتيال، طلب تحويل مشبوه، أو بائع غير موثوق." },
  { title: "طلب توثيق", desc: "توثيق حساب بائع/متجر/نشاط تجاري." },
  { title: "طلب ترويج", desc: "إعلان مميز أو ظهور أعلى النتائج." },
  { title: "مشكلة تقنية", desc: "خطأ في التطبيق أو الموقع." },
];

const faqs = [
  { q: "كيف أضيف إعلان؟", a: "من الصفحة الرئيسية أو القائمة السفلية، اضغط (أضف إعلان) واتبع الخطوات الخمس." },
  { q: "هل رَوَاج مجاني؟", a: "نعم، النشر والتصفح مجانيان بالكامل. الترويج المميز سيكون اختيارياً لاحقاً." },
  { q: "كيف أتواصل مع البائع؟", a: "من صفحة الإعلان عبر أزرار التواصل. سيتم تفعيلها بعد إطلاق الحسابات." },
  { q: "كيف أحذف إعلاناً؟", a: "ستتوفر إدارة الإعلانات من قائمة (إعلاناتي) بعد تفعيل تسجيل الدخول." },
  { q: "كيف أبلّغ عن إعلان؟", a: "من صفحة الإعلان عبر زر (إبلاغ). الميزة قيد التطوير." },
  { q: "كيف أطلب توثيق حسابي؟", a: "من صفحة الحساب → توثيق الحساب. يتطلب لاحقاً وثائق هوية أو سجل تجاري." },
];

function SupportPage() {
  const [type, setType] = useState(types[0]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [listingId, setListingId] = useState("");
  const [msg, setMsg] = useState("");

  return (
    <>
      <PageHeader title="الدعم والمساعدة" />
      <main className="container-wide pt-4 pb-8 space-y-5">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-soft">
          <div className="flex items-center gap-3">
            <LifeBuoy className="h-6 w-6 text-gold" />
            <div>
              <h2 className="text-lg font-extrabold">كيف يمكننا مساعدتك؟</h2>
              <p className="text-xs text-primary-foreground/80">فريق رَوَاج موجود لدعمك. ابحث في الأسئلة الشائعة أو راسلنا عبر النموذج.</p>
            </div>
          </div>
        </section>

        {/* Help topics */}
        <section>
          <h3 className="mb-3 text-sm font-extrabold">مواضيع المساعدة</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {helpTopics.map((t) => (
              <div key={t.title} className="rounded-2xl bg-card p-4 hairline">
                <div className="text-sm font-bold">{t.title}</div>
                <p className="mt-1 text-xs text-muted-foreground">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Support form */}
        <section>
          <h3 className="mb-3 text-sm font-extrabold">تواصل معنا</h3>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-3 rounded-2xl bg-card p-4 hairline">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">الاسم</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm" placeholder="اسمك" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">البريد الإلكتروني</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm" placeholder="example@email.com" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">نوع المشكلة</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm">
                  {types.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">رقم الإعلان (اختياري)</label>
                <input value={listingId} onChange={(e) => setListingId(e.target.value)} className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm" placeholder="مثال: 12" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">رسالتك</label>
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows={5}
                placeholder="اشرح المشكلة بالتفصيل…"
                className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
              />
            </div>
            <button type="button" disabled className="inline-flex items-center gap-2 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold text-muted-foreground cursor-not-allowed">
              <Paperclip className="h-3.5 w-3.5" /> إرفاق صورة · قريباً
            </button>
            <button
              type="submit"
              disabled
              title="إرسال الطلب — قريباً"
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground opacity-80 cursor-not-allowed"
            >
              إرسال الطلب · قريباً
            </button>
            <p className="text-[11px] text-muted-foreground">
              نموذج تجريبي — لن يتم إرسال البيانات حالياً. سيُفعَّل النموذج لاحقاً.
            </p>
          </form>
        </section>

        {/* FAQ */}
        <section>
          <h3 className="mb-3 text-sm font-extrabold">الأسئلة الشائعة</h3>
          <div className="overflow-hidden rounded-2xl bg-card hairline">
            {faqs.map((f, i) => (
              <details key={f.q} className={`group ${i !== 0 ? "border-t border-border" : ""}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-semibold">
                  {f.q}
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <p className="px-4 pb-4 text-xs text-muted-foreground leading-6">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="flex items-start gap-3 rounded-2xl bg-warning/10 p-4 hairline">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-xs">
            إذا كنت ضحية احتيال أو لاحظت نشاطاً مشبوهاً، راجع{" "}
            <Link to="/safety" className="font-bold text-primary underline-offset-2 hover:underline">نصائح الأمان</Link>
            {" "}قبل إرسال البلاغ.
          </p>
        </section>
      </main>
    </>
  );
}
