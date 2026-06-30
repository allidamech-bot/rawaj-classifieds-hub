import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, LifeBuoy, Mail, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [{ title: "الدعم | رواج" }] }),
  component: SupportPage,
});

const helpTopics = [
  {
    ar: "مشكلة في إعلان",
    en: "Listing issue",
    bodyAr: "إعلان مخالف، صور غير صحيحة، أو معلومات مضللة.",
    bodyEn: "Prohibited listing, incorrect photos, or misleading information.",
  },
  {
    ar: "مشكلة في حساب",
    en: "Account issue",
    bodyAr: "تسجيل الدخول، تحديث البيانات، أو إدارة الحساب.",
    bodyEn: "Login, data updates, or account management.",
  },
  {
    ar: "بلاغ أمان",
    en: "Safety report",
    bodyAr: "محاولة احتيال، طلب تحويل مشبوه، أو بائع غير موثوق.",
    bodyEn: "Fraud attempt, suspicious transfer request, or unreliable seller.",
  },
  {
    ar: "طلب ترويج",
    en: "Promotion request",
    bodyAr: "إعلان مميز أو ظهور أعلى في النتائج بعد مراجعة واضحة.",
    bodyEn: "Featured listing or top placement after clear review.",
  },
];

const faqs = [
  {
    qAr: "كيف أضيف إعلان؟",
    qEn: "How do I post a listing?",
    aAr: "اختر أضف إعلان ثم أدخل التفاصيل والصور. تظهر الإعلانات العامة بعد المراجعة والاعتماد.",
    aEn: "Choose Post listing, then enter details and photos. Public listings appear after review and approval.",
  },
  {
    qAr: "كيف أتواصل مع البائع؟",
    qEn: "How do I contact a seller?",
    aAr: "استخدم طرق التواصل الظاهرة داخل صفحة الإعلان فقط، ولا تحول أي مبلغ قبل المعاينة.",
    aEn: "Use only the contact methods shown on the listing page, and do not transfer money before inspection.",
  },
  {
    qAr: "كيف أبلغ عن إعلان؟",
    qEn: "How do I report a listing?",
    aAr: "استخدم زر البلاغ في صفحة الإعلان المعتمد حتى يصل البلاغ لمسار المراجعة.",
    aEn: "Use the report button on the approved listing page so the report reaches the review flow.",
  },
];

function SupportPage() {
  const { language, text } = useUiPreferences();

  return (
    <>
      <PageHeader title={text("الدعم والمساعدة", "Support and help")} />
      <main className="container-wide space-y-5 pt-4 pb-8">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-soft">
          <div className="flex items-center gap-3">
            <LifeBuoy className="h-6 w-6 text-gold" />
            <div>
              <h2 className="text-lg font-extrabold">
                {text("جهز تفاصيل طلبك بوضوح", "Prepare your request clearly")}
              </h2>
              <p className="mt-1 text-xs leading-6 text-primary-foreground/80">
                {text(
                  "لا يتم إنشاء تذكرة محفوظة من هذه الصفحة. اجمع التفاصيل المهمة ثم استخدم قناة التواصل الرسمية التي يعتمدها فريق رواج.",
                  "This page does not create a stored ticket. Gather the important details, then use the official contact channel approved by RAWAJ.",
                )}
              </p>
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-extrabold">{text("مواضيع المساعدة", "Help topics")}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {helpTopics.map((topic) => (
              <article key={topic.en} className="rounded-2xl bg-card p-4 hairline">
                <h4 className="text-sm font-bold">{language === "ar" ? topic.ar : topic.en}</h4>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  {language === "ar" ? topic.bodyAr : topic.bodyEn}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-card p-4 hairline">
          <h3 className="text-sm font-extrabold">
            {text("معلومات تساعد فريق الدعم", "Details that help support")}
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <SupportDetail
              label={text("رابط الإعلان أو رقمه عند وجوده", "Listing link or ID when relevant")}
            />
            <SupportDetail label={text("وصف مختصر للمشكلة", "Short issue description")} />
            <SupportDetail label={text("وقت حدوث المشكلة", "When the issue happened")} />
            <SupportDetail label={text("وسيلة تواصل للرد", "Contact method for reply")} />
          </div>
        </section>

        <section className="rounded-2xl bg-warning/10 p-4 text-xs leading-6 hairline">
          <ShieldAlert className="me-1 inline h-4 w-4 text-warning" />
          {text(
            "للبلاغات المرتبطة بإعلان معتمد، استخدم زر البلاغ داخل صفحة الإعلان حتى ترتبط المراجعة بالإعلان الصحيح.",
            "For reports tied to an approved listing, use the report button on the listing page so review is linked to the correct listing.",
          )}
        </section>

        <section>
          <h3 className="mb-3 text-sm font-extrabold">{text("الأسئلة الشائعة", "FAQ")}</h3>
          <div className="overflow-hidden rounded-2xl bg-card hairline">
            {faqs.map((faq, index) => (
              <details key={faq.qEn} className={index === 0 ? "" : "border-t border-border"}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-semibold">
                  {language === "ar" ? faq.qAr : faq.qEn}
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </summary>
                <p className="px-4 pb-4 text-xs leading-6 text-muted-foreground">
                  {language === "ar" ? faq.aAr : faq.aEn}
                </p>
              </details>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link
            to="/listings"
            className="rounded-xl bg-card px-4 py-2.5 text-center text-sm font-bold hairline"
          >
            {text("تصفح الإعلانات", "Browse listings")}
          </Link>
          <a
            href="mailto:support@rawaj.example"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <Mail className="h-4 w-4" />
            {text("إرسال التفاصيل بالبريد", "Send details by email")}
          </a>
        </div>
      </main>
    </>
  );
}

function SupportDetail({ label }: { label: string }) {
  return <div className="rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold">{label}</div>;
}
