import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, ShieldAlert } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  SupportRequestTimeline,
  TrustHubHero,
  TrustSectionHeader,
} from "@/features/trust/TrustSupportExperience";
import { createSupportRequest, fetchMySupportRequests } from "@/lib/classifieds-api";
import type { ClassifiedsError, SupportRequest, SupportRequestType } from "@/lib/classifieds-types";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/support")({
  head: () =>
    createSeo({
      title: "الدعم والمساعدة | RAWAJ / رواج",
      description:
        "أرسل طلب دعم محفوظ على رواج للمشكلات التقنية أو البلاغات أو أسئلة الإعلانات، مع مراجعة الطلبات من الفريق دون وعد برد فوري.",
      path: "/support",
    }),
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
  const auth = useAuth();
  const [requestType, setRequestType] = useState<SupportRequestType>("technical_issue");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [relatedListingId, setRelatedListingId] = useState("");
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [requestsError, setRequestsError] = useState<ClassifiedsError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (auth.status !== "signedIn") return;
    let cancelled = false;

    async function loadRequests() {
      setRequestsError(null);
      const result = await fetchMySupportRequests(auth.profile?.id ?? null);
      if (cancelled) return;
      if (result.ok) setRequests(result.data);
      else {
        setRequests([]);
        setRequestsError(result.error);
      }
    }

    void loadRequests();
    return () => {
      cancelled = true;
    };
  }, [auth.profile?.id, auth.status]);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setSubmitting(true);
    const result = await createSupportRequest(auth.profile?.id ?? null, {
      type: requestType,
      subject,
      message,
      relatedListingId: relatedListingId || null,
    });
    setSubmitting(false);

    if (!result.ok) {
      setNotice(result.error.message);
      return;
    }

    setRequests((current) => [result.data, ...current]);
    setSubject("");
    setMessage("");
    setRelatedListingId("");
    setRequestType("technical_issue");
    setNotice(text("تم إرسال طلب الدعم للمراجعة.", "Support request submitted for review."));
  }

  return (
    <>
      <PageHeader title={text("الدعم والمساعدة", "Support and help")} />
      <main className="rawaj-trust-v2 rawaj-support-v2 container-wide mobile-page-bottom space-y-5 pb-8 pt-4">
        <TrustHubHero
          mode="support"
          signedIn={auth.status === "signedIn"}
          displayName={auth.profile?.displayName ?? undefined}
          location={auth.profile?.cityArea || auth.profile?.governorate || undefined}
          avatarUrl={auth.profile?.avatarUrl}
          verified={auth.profile?.verificationStatus === "verified"}
        />
        <div className="rawaj-support-v2__layout">
          <div className="rawaj-support-v2__main">
            <section className="rawaj-support-panel">
              <TrustSectionHeader
                eyebrow={text("طلب جديد", "New request")}
                title={text("إرسال طلب دعم محفوظ", "Submit a stored support request")}
                description={text(
                  "اكتب الموضوع والتفاصيل واربط الطلب بإعلان عند الحاجة.",
                  "Describe the issue and link the request to a listing when relevant.",
                )}
              />
              {auth.status === "signedIn" ? (
                <form onSubmit={(event) => void submitRequest(event)}>
                  <label className="block">
                    <span className="text-xs font-bold text-muted-foreground">
                      {text("نوع الطلب", "Request type")}
                    </span>
                    <select
                      value={requestType}
                      onChange={(event) => setRequestType(event.target.value as SupportRequestType)}
                    >
                      <option value="complaint">{text("شكوى", "Complaint")}</option>
                      <option value="suggestion">{text("اقتراح", "Suggestion")}</option>
                      <option value="technical_issue">
                        {text("مشكلة تقنية", "Technical issue")}
                      </option>
                      <option value="abuse_report">
                        {text("إساءة أو مخالفة", "Abuse report")}
                      </option>
                      <option value="other">{text("أخرى", "Other")}</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-muted-foreground">
                      {text("العنوان", "Subject")}
                    </span>
                    <input
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      maxLength={160}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-muted-foreground">
                      {text("رقم الإعلان المرتبط اختياري", "Related listing ID, optional")}
                    </span>
                    <input
                      value={relatedListingId}
                      onChange={(event) => setRelatedListingId(event.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-muted-foreground">
                      {text("الرسالة", "Message")}
                    </span>
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      maxLength={3000}
                      rows={5}
                    />
                  </label>
                  <button type="submit" disabled={submitting}>
                    {submitting
                      ? text("جار الإرسال", "Submitting")
                      : text("إرسال الطلب", "Submit request")}
                  </button>
                  {notice && <p className="rawaj-support-notice">{notice}</p>}
                </form>
              ) : (
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  {text(
                    "سجل الدخول لإرسال طلب دعم محفوظ ومتابعة حالته.",
                    "Log in to submit a stored support request and track its status.",
                  )}
                </p>
              )}
            </section>

            {auth.status === "signedIn" ? (
              <section className="rawaj-support-requests">
                <TrustSectionHeader
                  eyebrow={text("المتابعة", "Tracking")}
                  title={text("طلباتي", "My requests")}
                  description={text(
                    "آخر طلبات الدعم المحفوظة وحالة مراجعتها.",
                    "Your latest stored support requests and review status.",
                  )}
                />
                {requestsError ? (
                  <p className="rawaj-support-notice">{requestsError.message}</p>
                ) : (
                  <SupportRequestTimeline requests={requests} language={language} />
                )}
              </section>
            ) : null}

            <section className="rawaj-support-topics">
              <TrustSectionHeader
                eyebrow={text("الإرشاد", "Guidance")}
                title={text("مواضيع المساعدة", "Help topics")}
              />
              <div className="rawaj-support-topic-grid">
                {helpTopics.map((topic) => (
                  <article key={topic.en} className="rawaj-support-topic">
                    <h4 className="text-sm font-bold">{language === "ar" ? topic.ar : topic.en}</h4>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">
                      {language === "ar" ? topic.bodyAr : topic.bodyEn}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rawaj-support-notice">
              <ShieldAlert className="me-1 inline h-4 w-4 text-warning" />
              {text(
                "للبلاغات المرتبطة بإعلان معتمد، استخدم زر البلاغ داخل صفحة الإعلان حتى ترتبط المراجعة بالإعلان الصحيح.",
                "For reports tied to an approved listing, use the report button on the listing page so review is linked to the correct listing.",
              )}
            </section>

            <section className="rawaj-support-faq">
              <TrustSectionHeader
                eyebrow={text("الأسئلة", "Questions")}
                title={text("الأسئلة الشائعة", "FAQ")}
              />
              <div>
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
          </div>
          <aside className="rawaj-support-v2__aside">
            <section className="rawaj-support-topics">
              <TrustSectionHeader
                eyebrow={text("قبل الإرسال", "Before submitting")}
                title={text("معلومات تساعد فريق الدعم", "Details that help support")}
              />
              <div className="rawaj-support-topic-grid">
                <SupportDetail
                  label={text("رابط الإعلان أو رقمه عند وجوده", "Listing link or ID when relevant")}
                />
                <SupportDetail label={text("وصف مختصر للمشكلة", "Short issue description")} />
                <SupportDetail label={text("وقت حدوث المشكلة", "When the issue happened")} />
                <SupportDetail label={text("وسيلة تواصل للرد", "Contact method for reply")} />
              </div>
            </section>
          </aside>
        </div>

        <div className="rawaj-safety-actions">
          <Link
            to="/listings"
            className="rounded-xl bg-card px-4 py-2.5 text-center text-sm font-bold hairline"
          >
            {text("تصفح الإعلانات", "Browse listings")}
          </Link>
          <Link
            to="/safety"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            {text("نصائح الأمان والبلاغات", "Safety and reports")}
          </Link>
        </div>
      </main>
    </>
  );
}

function SupportDetail({ label }: { label: string }) {
  return <div className="rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold">{label}</div>;
}
