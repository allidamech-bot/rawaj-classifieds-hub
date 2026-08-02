import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingCart, Store, CreditCard, Flag } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SafetyGuideCard, TrustHubHero } from "@/features/trust/TrustSupportExperience";
import { createSeo } from "@/lib/seo";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";

export const Route = createFileRoute("/safety")({
  head: () =>
    createSeo({
      title: "نصائح الأمان والتعامل الآمن | RAWAJ / رواج",
      description:
        "إرشادات رواج للتعامل الآمن عند بيع وشراء الإعلانات المبوبة في السعودية، مع نصائح للمعاينة والدفع والتبليغ عن المخالفات.",
      path: "/safety",
    }),
  component: SafetyPage,
});

const sections: {
  icon: typeof ShoppingCart;
  title: string;
  items: string[];
  tone?: "warn";
}[] = [
  {
    icon: ShoppingCart,
    title: "أمان المشتري",
    items: [
      "افحص السلعة قبل الدفع.",
      "قابل البائع في مكان عام وآمن.",
      "لا تحوّل المال قبل التأكد.",
      "احذر الأسعار غير المنطقية.",
      "اطلب صوراً إضافية أو معاينة فيديو عند الشك.",
    ],
  },
  {
    icon: Store,
    title: "أمان البائع",
    items: [
      "لا تشارك بيانات حساسة (هوية، حسابات بنكية، رموز).",
      "تأكد من جدية المشتري قبل تحديد موعد المعاينة.",
      "استخدم أماكن آمنة للتسليم.",
      "احتفظ بسجل المحادثة وأي اتفاق واضح بين الطرفين.",
    ],
  },
  {
    icon: CreditCard,
    title: "أمان الدفع والتحويل",
    tone: "warn",
    items: [
      "لا يوجد نظام دفع داخل رَوَاج حالياً.",
      "أي تحويل خارج المنصة هو على مسؤولية المستخدم.",
      "لا تعتمد أي طريقة دفع غير موثقة أو غير واضحة.",
      "لا تشارك أرقام بطاقات أو كلمات مرور مع أي طرف.",
    ],
  },
  {
    icon: Flag,
    title: "التبليغ والإبلاغ",
    items: [
      "بلّغ عن الإعلانات المشبوهة أو المضللة.",
      "بلّغ عن المستخدمين المسيئين أو الذين يحاولون الاحتيال.",
      "استخدم زر الإبلاغ أو صفحة الدعم عند وجود خطر أو مخالفة.",
    ],
  },
];

function SafetyPage() {
  const { language, text } = useUiPreferences();

  return (
    <>
      <PageHeader title={text("نصائح الأمان", "Safety tips")} />
      <main className="rawaj-trust-v2 rawaj-safety-v2 container-wide mobile-page-bottom space-y-4 pb-8 pt-4">
        <TrustHubHero mode="safety" />

        <div className="rawaj-safety-guide-grid">
          {sections.map((section) => (
            <SafetyGuideCard
              key={section.title}
              icon={section.icon}
              title={safetyText(section.title, language)}
              items={section.items.map((item) => safetyText(item, language))}
              warning={section.tone === "warn"}
            />
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {text("هل تحتاج مساعدة؟", "Need help?")}{" "}
          <Link to="/support" className="font-bold text-primary underline-offset-2 hover:underline">
            {text("تواصل مع الدعم", "Contact support")}
          </Link>
        </p>

        <div className="rawaj-safety-actions">
          <Link
            to="/prohibited"
            className="rounded-xl bg-card px-4 py-2.5 text-center text-xs font-bold hairline"
          >
            {text("راجع الإعلانات الممنوعة", "Review prohibited listings")}
          </Link>
          <Link
            to="/listings"
            className="rounded-xl bg-primary px-4 py-2.5 text-center text-xs font-bold text-primary-foreground"
          >
            {text("تصفح بإرشادات الأمان", "Browse with safety tips")}
          </Link>
        </div>
      </main>
    </>
  );
}

function safetyText(value: string, language: Language) {
  if (language === "ar") return value;
  const labels: Record<string, string> = {
    "أمان المشتري": "Buyer safety",
    "افحص السلعة قبل الدفع.": "Inspect the item before paying.",
    "قابل البائع في مكان عام وآمن.": "Meet the seller in a public, safe place.",
    "لا تحوّل المال قبل التأكد.": "Do not transfer money before verifying.",
    "احذر الأسعار غير المنطقية.": "Be cautious with unrealistic prices.",
    "اطلب صوراً إضافية أو معاينة فيديو عند الشك.":
      "Ask for more photos or a short video when unsure.",
    "أمان البائع": "Seller safety",
    "لا تشارك بيانات حساسة (هوية، حسابات بنكية، رموز).":
      "Do not share sensitive data such as ID, bank details, or codes.",
    "تأكد من جدية المشتري قبل تحديد موعد المعاينة.":
      "Confirm buyer seriousness before setting a viewing time.",
    "استخدم أماكن آمنة للتسليم.": "Use safe places for handover.",
    "احتفظ بسجل المحادثة وأي اتفاق واضح بين الطرفين.":
      "Keep a record of the conversation and any clear agreement between both sides.",
    "أمان الدفع والتحويل": "Payment and transfer safety",
    "لا يوجد نظام دفع داخل رَوَاج حالياً.": "RAWAJ does not currently provide in-app payment.",
    "أي تحويل خارج المنصة هو على مسؤولية المستخدم.":
      "Any transfer outside the platform is the user's responsibility.",
    "لا تعتمد أي طريقة دفع غير موثقة أو غير واضحة.":
      "Do not rely on unclear or unverified payment methods.",
    "لا تشارك أرقام بطاقات أو كلمات مرور مع أي طرف.":
      "Do not share card numbers or passwords with anyone.",
    "التبليغ والإبلاغ": "Reporting",
    "بلّغ عن الإعلانات المشبوهة أو المضللة.": "Report suspicious or misleading listings.",
    "بلّغ عن المستخدمين المسيئين أو الذين يحاولون الاحتيال.":
      "Report abusive users or suspected scams.",
    "استخدم زر الإبلاغ أو صفحة الدعم عند وجود خطر أو مخالفة.":
      "Use the report button or support page when there is risk or a violation.",
  };
  return labels[value] ?? value;
}
