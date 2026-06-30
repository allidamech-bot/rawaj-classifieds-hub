import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { CheckCircle, ChevronDown, LifeBuoy, Paperclip, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";

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
  { title: "مشكلة في حساب", desc: "تسجيل الدخول، تحديث البيانات، أو إدارة الحساب." },
  { title: "بلاغ عن احتيال", desc: "محاولة احتيال، طلب تحويل مشبوه، أو بائع غير موثوق." },
  { title: "طلب توثيق", desc: "توثيق حساب بائع أو متجر أو نشاط تجاري." },
  { title: "طلب ترويج", desc: "إعلان مميز أو ظهور أعلى في النتائج." },
  { title: "مشكلة تقنية", desc: "خطأ في التطبيق أو الموقع." },
];

const faqs = [
  {
    q: "كيف أضيف إعلان؟",
    a: "من الصفحة الرئيسية أو القائمة السفلية، اضغط أضف إعلان واتبع خطوات إدخال التفاصيل والمراجعة.",
  },
  {
    q: "هل رَوَاج مجاني؟",
    a: "نعم، التصفح ونشر الإعلان الأساسي مجانيان. خدمات الترويج اختيارية وتظهر تفاصيلها بوضوح قبل إرسال الطلب.",
  },
  {
    q: "كيف أتواصل مع البائع؟",
    a: "من صفحة الإعلان عبر أزرار التواصل المتاحة. اختر دائماً طريقة آمنة ولا تحوّل أي مبلغ قبل المعاينة.",
  },
  {
    q: "كيف أبلّغ عن إعلان؟",
    a: "من صفحة الإعلان استخدم زر الإبلاغ، أو أرسل لنا التفاصيل من نموذج الدعم عند الحاجة.",
  },
  {
    q: "كيف أطلب توثيق حسابي؟",
    a: "يمكنك إرسال طلب من صفحة الدعم مع شرح مختصر لطبيعة الحساب، وسيراجع الفريق الطلب وفق قواعد السلامة.",
  },
];

function SupportPage() {
  const { language, text } = useUiPreferences();
  const [type, setType] = useState(types[0]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [listingId, setListingId] = useState("");
  const [msg, setMsg] = useState("");
  const [attachmentPrepared, setAttachmentPrepared] = useState(false);
  const [submittedRef, setSubmittedRef] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const ref = `RWJ-${Date.now().toString().slice(-6)}`;
    setSubmittedRef(ref);
  }

  return (
    <>
      <PageHeader title={text("الدعم والمساعدة", "Support and help")} />
      <main className="container-wide pt-4 pb-8 space-y-5">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-soft">
          <div className="flex items-center gap-3">
            <LifeBuoy className="h-6 w-6 text-gold" />
            <div>
              <h2 className="text-lg font-extrabold">
                {text("كيف يمكننا مساعدتك؟", "How can we help?")}
              </h2>
              <p className="text-xs text-primary-foreground/80">
                {text(
                  "ابحث في الأسئلة الشائعة أو أرسل طلباً منظماً يساعد فريق رَوَاج على مراجعة المشكلة بسرعة.",
                  "Check the FAQs or prepare a structured request so RAWAJ can review the issue clearly.",
                )}
              </p>
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-extrabold">{text("مواضيع المساعدة", "Help topics")}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {helpTopics.map((topic) => (
              <div key={topic.title} className="rounded-2xl bg-card p-4 hairline">
                <div className="text-sm font-bold">{supportText(topic.title, language)}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {supportText(topic.desc, language)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-extrabold">{text("تواصل معنا", "Contact us")}</h3>
          <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-card p-4 hairline">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={text("الاسم", "Name")}>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
                  placeholder={text("اسمك", "Your name")}
                />
              </Field>
              <Field label={text("البريد الإلكتروني", "Email")}>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
                  placeholder="example@email.com"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={text("نوع المشكلة", "Issue type")}>
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
                >
                  {types.map((item) => (
                    <option key={item} value={item}>
                      {supportText(item, language)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={text("رقم الإعلان (اختياري)", "Listing ID (optional)")}>
                <input
                  value={listingId}
                  onChange={(event) => setListingId(event.target.value)}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
                  placeholder={text("مثال: 12", "Example: 12")}
                />
              </Field>
            </div>
            <Field label={text("رسالتك", "Your message")}>
              <textarea
                value={msg}
                onChange={(event) => setMsg(event.target.value)}
                rows={5}
                placeholder={text("اشرح المشكلة بالتفصيل...", "Describe the issue in detail...")}
                className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAttachmentPrepared(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold"
              >
                <Paperclip className="h-3.5 w-3.5" />
                {text("إضافة ملاحظة للمرفق", "Add attachment note")}
              </button>
              {attachmentPrepared && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-trust/10 px-3 py-1 text-[11px] font-bold text-emerald-trust">
                  <CheckCircle className="h-3 w-3" />
                  {text("تم تجهيز خانة المرفق للمراجعة", "Attachment note prepared for review")}
                </span>
              )}
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
            >
              {text("إرسال الطلب", "Submit request")}
            </button>
            {submittedRef && (
              <div className="rounded-xl bg-emerald-trust/10 p-3 text-xs leading-6 text-emerald-trust">
                <strong>{text("تم تجهيز الطلب", "Request prepared")}</strong>
                <span className="mx-1">·</span>
                {text("رقم المتابعة", "Reference")} {submittedRef}.{" "}
                {text(
                  "هذه حالة واجهة محلية ولا تعني إنشاء تذكرة محفوظة على الخادم.",
                  "This is a local interface state and does not mean a server-stored ticket was created.",
                )}
              </div>
            )}
          </form>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-extrabold">{text("الأسئلة الشائعة", "FAQ")}</h3>
          <div className="overflow-hidden rounded-2xl bg-card hairline">
            {faqs.map((faq, index) => (
              <details
                key={faq.q}
                className={`group ${index !== 0 ? "border-t border-border" : ""}`}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-semibold">
                  {supportText(faq.q, language)}
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <p className="px-4 pb-4 text-xs leading-6 text-muted-foreground">
                  {supportText(faq.a, language)}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="flex items-start gap-3 rounded-2xl bg-warning/10 p-4 hairline">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-xs leading-6">
            {text(
              "إذا كنت ضحية احتيال أو لاحظت نشاطاً مشبوهاً، راجع",
              "If you experienced fraud or suspicious activity, review",
            )}{" "}
            <Link
              to="/safety"
              className="font-bold text-primary underline-offset-2 hover:underline"
            >
              {text("نصائح الأمان", "safety tips")}
            </Link>{" "}
            {text("قبل إرسال البلاغ.", "before sending a report.")}
          </p>
        </section>
      </main>
    </>
  );
}

function supportText(value: string, language: Language) {
  if (language === "ar") return value;
  const labels: Record<string, string> = {
    "مشكلة في إعلان": "Listing issue",
    "مشكلة في حساب": "Account issue",
    "بلاغ عن احتيال": "Fraud report",
    "طلب توثيق": "Verification request",
    "طلب ترويج": "Promotion request",
    "مشكلة تقنية": "Technical issue",
    "اقتراح أو ملاحظة": "Suggestion or note",
    "إعلان مخالف، صور غير صحيحة، أو معلومات مضللة.":
      "Prohibited listing, incorrect photos, or misleading information.",
    "تسجيل الدخول، تحديث البيانات، أو إدارة الحساب.": "Login, data updates, or account management.",
    "محاولة احتيال، طلب تحويل مشبوه، أو بائع غير موثوق.":
      "Fraud attempt, suspicious transfer request, or unreliable seller.",
    "توثيق حساب بائع أو متجر أو نشاط تجاري.": "Verify a seller, store, or business account.",
    "إعلان مميز أو ظهور أعلى في النتائج.": "Featured listing or top placement.",
    "خطأ في التطبيق أو الموقع.": "App or website issue.",
    "كيف أضيف إعلان؟": "How do I post a listing?",
    "من الصفحة الرئيسية أو القائمة السفلية، اضغط أضف إعلان واتبع خطوات إدخال التفاصيل والمراجعة.":
      "From the home page or bottom nav, choose Post a listing and follow the listing and review steps.",
    "هل رَوَاج مجاني؟": "Is RAWAJ free?",
    "نعم، التصفح ونشر الإعلان الأساسي مجانيان. خدمات الترويج اختيارية وتظهر تفاصيلها بوضوح قبل إرسال الطلب.":
      "Yes, browsing and basic posting are free. Optional promotion details are shown clearly before submitting a request.",
    "كيف أتواصل مع البائع؟": "How do I contact a seller?",
    "من صفحة الإعلان عبر أزرار التواصل المتاحة. اختر دائماً طريقة آمنة ولا تحوّل أي مبلغ قبل المعاينة.":
      "Use the available contact buttons on the listing page. Always choose a safe method and do not transfer money before inspection.",
    "كيف أبلّغ عن إعلان؟": "How do I report a listing?",
    "من صفحة الإعلان استخدم زر الإبلاغ، أو أرسل لنا التفاصيل من نموذج الدعم عند الحاجة.":
      "Use Report on the listing page, or send details through the support form when needed.",
    "كيف أطلب توثيق حسابي؟": "How do I request verification?",
    "يمكنك إرسال طلب من صفحة الدعم مع شرح مختصر لطبيعة الحساب، وسيراجع الفريق الطلب وفق قواعد السلامة.":
      "You can send a support request with a short explanation of the account type, and the team will review it under safety rules.",
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
