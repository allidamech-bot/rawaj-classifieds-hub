import { createFileRoute, Link } from "@tanstack/react-router";
import { Ban, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { createSeo } from "@/lib/seo";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";

export const Route = createFileRoute("/prohibited")({
  head: () =>
    createSeo({
      title: "الإعلانات الممنوعة | RAWAJ / رواج",
      description:
        "قائمة الإعلانات والمحتوى الممنوع على رواج، مع توضيح كيفية الإبلاغ عن إعلان مخالف لمسار المراجعة.",
      path: "/prohibited",
    }),
  component: ProhibitedPage,
});

const items = [
  "الأسلحة والذخائر والمتفجرات بكافة أنواعها",
  "المواد المخدرة والمواد غير القانونية",
  "الأدوية المقيدة دون وصفة وأي مواد طبية ممنوعة",
  "البضائع المسروقة أو مجهولة المصدر",
  "العروض الاحتيالية والعمليات الوهمية",
  "الوثائق المزوّرة (هويات، شهادات، عملات)",
  "محتوى مسيء، عنصري، أو محرّض على الكراهية",
  "خدمات غير قانونية أو مخالفة للنظام العام",
  "الاتجار بالبشر أو أي شكل من أشكال الاستغلال",
  "المنتجات الخطرة على السلامة العامة",
  "المنتجات المقلّدة والعلامات التجارية المسروقة",
  "العروض المالية المشبوهة (احتيال، عمولات وهمية، استثمار وهمي)",
  "محتوى جنسي صريح أو مخالف للقانون",
  "أي محتوى مضلّل أو معلومات إعلان غير صحيحة",
  "كل ما يخالف القوانين السورية أو أنظمة المنصة",
];

function ProhibitedPage() {
  const { language, text } = useUiPreferences();

  return (
    <>
      <PageHeader title={text("الإعلانات الممنوعة", "Prohibited listings")} />
      <main className="rawaj-prohibited-v3 container-wide mobile-page-bottom space-y-4 pt-4">
        <div className="rounded-2xl bg-destructive/10 p-4 hairline">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-bold text-destructive">
                {text("إعلانات ممنوعة على رَوَاج", "Listings prohibited on RAWAJ")}
              </p>
              <p className="mt-1 text-xs text-foreground/80">
                {text(
                  "قد تتم إزالة أي إعلان يخالف هذه القائمة بعد المراجعة، مع إمكانية اتخاذ إجراء مناسب على الحساب المخالف وفق الصلاحيات.",
                  "Listings that violate this list may be removed after review, with suitable account action under the applicable permissions.",
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((t) => (
            <div key={t} className="flex items-start gap-3 rounded-xl bg-card p-3 hairline">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
                <Ban className="h-4 w-4" />
              </span>
              <span className="pt-1 text-sm font-medium">{prohibitedText(t, language)}</span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-card p-4 hairline text-xs text-muted-foreground">
          <p className="font-bold text-foreground mb-1">
            {text("كيف تبلّغ عن إعلان مخالف؟", "How do you report a prohibited listing?")}
          </p>
          <p>
            {text(
              "من صفحة الإعلان، اضغط على زر (إبلاغ عن الإعلان). في الحالات العاجلة، يمكنك التواصل عبر",
              "From the listing page, choose Report listing. For urgent cases, contact",
            )}{" "}
            <Link
              to="/support"
              className="font-bold text-primary underline-offset-2 hover:underline"
            >
              {text("صفحة الدعم", "support")}
            </Link>
            .
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link
            to="/safety"
            className="rounded-xl bg-card px-4 py-2.5 text-center text-xs font-bold hairline"
          >
            {text("نصائح التعامل الآمن", "Safe trading tips")}
          </Link>
          <Link
            to="/support"
            className="rounded-xl bg-primary px-4 py-2.5 text-center text-xs font-bold text-primary-foreground"
          >
            {text("تواصل مع الدعم", "Contact support")}
          </Link>
        </div>
      </main>
    </>
  );
}

function prohibitedText(value: string, language: Language) {
  if (language === "ar") return value;
  const labels: Record<string, string> = {
    "الأسلحة والذخائر والمتفجرات بكافة أنواعها": "Weapons, ammunition, and explosives of all kinds",
    "المواد المخدرة والمواد غير القانونية": "Drugs and illegal substances",
    "الأدوية المقيدة دون وصفة وأي مواد طبية ممنوعة":
      "Restricted medicines without prescription and prohibited medical materials",
    "البضائع المسروقة أو مجهولة المصدر": "Stolen goods or goods of unknown origin",
    "العروض الاحتيالية والعمليات الوهمية": "Fraudulent offers and fake transactions",
    "الوثائق المزوّرة (هويات، شهادات، عملات)":
      "Forged documents such as IDs, certificates, or currency",
    "محتوى مسيء، عنصري، أو محرّض على الكراهية": "Abusive, racist, or hate-inciting content",
    "خدمات غير قانونية أو مخالفة للنظام العام": "Illegal services or services against public order",
    "الاتجار بالبشر أو أي شكل من أشكال الاستغلال": "Human trafficking or any form of exploitation",
    "المنتجات الخطرة على السلامة العامة": "Products dangerous to public safety",
    "المنتجات المقلّدة والعلامات التجارية المسروقة": "Counterfeit products or stolen trademarks",
    "العروض المالية المشبوهة (احتيال، عمولات وهمية، استثمار وهمي)":
      "Suspicious financial offers, fraud, fake commissions, or fake investments",
    "محتوى جنسي صريح أو مخالف للقانون": "Explicit sexual or unlawful content",
    "أي محتوى مضلّل أو معلومات إعلان غير صحيحة":
      "Misleading content or incorrect listing information",
    "كل ما يخالف القوانين السورية أو أنظمة المنصة":
      "Anything that violates Syrian law or platform rules",
  };
  return labels[value] ?? value;
}
