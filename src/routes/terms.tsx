import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { createSeo } from "@/lib/seo";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";

export const Route = createFileRoute("/terms")({
  head: () =>
    createSeo({
      title: "شروط الاستخدام | RAWAJ / رواج",
      description:
        "شروط استخدام رواج للإعلانات المبوبة في السعودية، بما يشمل مسؤولية المستخدمين، الإعلانات، التواصل، البلاغات، وحدود الخدمة.",
      path: "/terms",
    }),
  component: TermsPage,
});

const sections = [
  {
    h: "طبيعة المنصة",
    p: "رَوَاج منصة إعلانات مبوّبة مجانية موجّهة للمستخدمين داخل الجمهورية العربية السورية، تُتيح للأفراد والمتاجر نشر إعلاناتهم وعرض سلعهم وخدماتهم. لا تتم داخل المنصة أي عملية بيع أو شراء أو دفع مباشر.",
  },
  {
    h: "الاستخدام المقبول",
    p: "يلتزم المستخدمون باستخدام رَوَاج بطريقة قانونية ومسؤولة، واحترام القوانين المحلية، والامتناع عن أي محتوى مسيء أو احتيالي أو مخالف للآداب العامة.",
  },
  {
    h: "مجانية النشر",
    p: "نشر الإعلانات وتصفّحها مجانيان بالكامل. خدمات الترويج اختيارية وتخضع لمراجعة واضحة قبل أي تفعيل.",
  },
  {
    h: "مسؤولية المستخدم عن محتوى الإعلان",
    p: "يتحمل المستخدم وحده كامل المسؤولية القانونية والمعنوية عن محتوى إعلاناته، وصحة الصور والمواصفات والأسعار والمعلومات الواردة فيها، وامتلاكه الحق في نشرها.",
  },
  {
    h: "عدم ضمان التعاملات",
    p: "لا يضمن رَوَاج نتائج أي تعامل بين المستخدمين، ولا يتحمل مسؤولية جودة السلع أو الخدمات أو صحة الادعاءات أو موثوقية البائع أو المشتري.",
  },
  {
    h: "الإعلانات الممنوعة",
    p: "يُحظر نشر إعلانات تخالف القوانين السورية، أو تتعلق بالأسلحة، المخدرات، المسروقات، الاحتيال، أو أي محتوى ممنوع. راجع صفحة الإعلانات الممنوعة للقائمة الكاملة.",
  },
  {
    h: "التواصل بين المستخدمين",
    p: "يتم التواصل بين البائع والمشتري على مسؤوليتهما. لا يتدخل رَوَاج في تفاصيل المفاوضة أو الدفع أو التسليم، ويجب عدم مشاركة كلمات المرور أو رموز التحقق مع أي مستخدم.",
  },
  {
    h: "البلاغات والإشراف",
    p: "تتم مراجعة الإعلانات والبلاغات واتخاذ الإجراءات المناسبة وفق سياسات المنصة وصلاحيات الإدارة. قد يشمل ذلك إخفاء المحتوى أو رفضه أو تقييد الحساب عند وجود مخالفة أو خطر أمني.",
  },
  {
    h: "تعليق وإلغاء الحساب",
    p: "يحق لرَوَاج تعليق أو تقييد أو إلغاء أي حساب يثبت تكرار مخالفته للشروط أو استخدامه بطريقة تضر بالمنصة أو المستخدمين، مع التعامل مع البيانات وفق سياسة الخصوصية.",
  },
  {
    h: "حدود الخدمة",
    p: "رَوَاج لا يضمن إتمام الصفقات بين المستخدمين ولا يعالج المدفوعات مباشرة. قد تتغير بعض الخصائص أو تتوقف مؤقتاً للصيانة أو الأمان أو المتطلبات التشغيلية.",
  },
  {
    h: "تعديل الشروط",
    p: "قد يتم تحديث هذه الشروط مع تطوّر المنصة أو المتطلبات التنظيمية. سننشر النسخة المحدثة وتاريخ سريانها، ويُعد استمرار استخدام رَوَاج بعد نشر التحديث موافقة على الشروط المعدلة.",
  },
  {
    h: "القانون المعمول به",
    p: "تخضع هذه الشروط للقوانين والأنظمة السورية المعمول بها، وأي نزاع يُحلّ ودياً أولاً ثم وفق الاختصاص القانوني المحلي.",
  },
];

function TermsPage() {
  const { language, text } = useUiPreferences();

  return (
    <>
      <PageHeader title={text("شروط الاستخدام", "Terms of use")} />
      <main className="rawaj-legal-v3 container-wide mobile-page-bottom pt-4">
        <p className="mb-4 text-xs text-muted-foreground">
          {text(
            "آخر تحديث: 12 تموز 2026. تسري هذه الشروط على استخدام موقع وتطبيق رَوَاج والخدمات المرتبطة بهما.",
            "Last updated: July 12, 2026. These terms apply to the RAWAJ website, app, and related services.",
          )}
        </p>
        <div className="space-y-3">
          {sections.map((s, i) => (
            <section key={i} className="rounded-2xl bg-card p-4 hairline">
              <h2 className="mb-2 text-base font-extrabold text-foreground">
                {i + 1}. {legalText(s.h, language)}
              </h2>
              <p className="text-sm leading-7 text-foreground/90">{legalText(s.p, language)}</p>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}

function legalText(value: string, language: Language) {
  if (language === "ar") return value;
  const labels: Record<string, string> = {
    "طبيعة المنصة": "Platform nature",
    "رَوَاج منصة إعلانات مبوّبة مجانية موجّهة للمستخدمين داخل الجمهورية العربية السورية، تُتيح للأفراد والمتاجر نشر إعلاناتهم وعرض سلعهم وخدماتهم. لا تتم داخل المنصة أي عملية بيع أو شراء أو دفع مباشر.":
      "RAWAJ is a free classifieds platform for users in Saudi Arabia, allowing individuals and stores to publish listings for goods and services. The platform does not directly process sales, purchases, or payments.",
    "الاستخدام المقبول": "Acceptable use",
    "يلتزم المستخدمون باستخدام رَوَاج بطريقة قانونية ومسؤولة، واحترام القوانين المحلية، والامتناع عن أي محتوى مسيء أو احتيالي أو مخالف للآداب العامة.":
      "Users must use RAWAJ lawfully and responsibly, respect local laws, and avoid abusive, fraudulent, or inappropriate content.",
    "مجانية النشر": "Free posting",
    "نشر الإعلانات وتصفّحها مجانيان بالكامل. خدمات الترويج اختيارية وتخضع لمراجعة واضحة قبل أي تفعيل.":
      "Posting and browsing are free. Promotion services are optional and subject to clear review before activation.",
    "مسؤولية المستخدم عن محتوى الإعلان": "User responsibility for listing content",
    "يتحمل المستخدم وحده كامل المسؤولية القانونية والمعنوية عن محتوى إعلاناته، وصحة الصور والمواصفات والأسعار والمعلومات الواردة فيها، وامتلاكه الحق في نشرها.":
      "The user is solely responsible for listing content, including the accuracy of photos, specifications, prices, and information, and for having the right to publish it.",
    "عدم ضمان التعاملات": "No transaction guarantee",
    "لا يضمن رَوَاج نتائج أي تعامل بين المستخدمين، ولا يتحمل مسؤولية جودة السلع أو الخدمات أو صحة الادعاءات أو موثوقية البائع أو المشتري.":
      "RAWAJ does not guarantee outcomes between users and is not responsible for item or service quality, claims, or buyer or seller reliability.",
    "الإعلانات الممنوعة": "Prohibited listings",
    "يُحظر نشر إعلانات تخالف القوانين السورية، أو تتعلق بالأسلحة، المخدرات، المسروقات، الاحتيال، أو أي محتوى ممنوع. راجع صفحة الإعلانات الممنوعة للقائمة الكاملة.":
      "Listings that violate Saudi law or involve weapons, drugs, stolen goods, fraud, or other prohibited content are not allowed. See the Prohibited Listings page for the full list.",
    "التواصل بين المستخدمين": "User communication",
    "يتم التواصل بين البائع والمشتري على مسؤوليتهما. لا يتدخل رَوَاج في تفاصيل المفاوضة أو الدفع أو التسليم، ويجب عدم مشاركة كلمات المرور أو رموز التحقق مع أي مستخدم.":
      "Buyer-seller communication is their responsibility. RAWAJ does not intervene in negotiation, payment, or delivery details, and users must never share passwords or verification codes.",
    "البلاغات والإشراف": "Reports and moderation",
    "تتم مراجعة الإعلانات والبلاغات واتخاذ الإجراءات المناسبة وفق سياسات المنصة وصلاحيات الإدارة. قد يشمل ذلك إخفاء المحتوى أو رفضه أو تقييد الحساب عند وجود مخالفة أو خطر أمني.":
      "Listings and reports are reviewed and suitable action is taken under platform policies and admin permissions. This may include hiding or rejecting content or restricting an account when a violation or safety risk exists.",
    "تعليق وإلغاء الحساب": "Account suspension and removal",
    "يحق لرَوَاج تعليق أو تقييد أو إلغاء أي حساب يثبت تكرار مخالفته للشروط أو استخدامه بطريقة تضر بالمنصة أو المستخدمين، مع التعامل مع البيانات وفق سياسة الخصوصية.":
      "RAWAJ may suspend, restrict, or remove accounts that repeatedly violate these terms or harm the platform or its users, while handling data under the privacy policy.",
    "حدود الخدمة": "Service limits",
    "رَوَاج لا يضمن إتمام الصفقات بين المستخدمين ولا يعالج المدفوعات مباشرة. قد تتغير بعض الخصائص أو تتوقف مؤقتاً للصيانة أو الأمان أو المتطلبات التشغيلية.":
      "RAWAJ does not guarantee completion of transactions between users and does not directly process payments. Features may change or become temporarily unavailable for maintenance, safety, or operational reasons.",
    "تعديل الشروط": "Changes to terms",
    "قد يتم تحديث هذه الشروط مع تطوّر المنصة أو المتطلبات التنظيمية. سننشر النسخة المحدثة وتاريخ سريانها، ويُعد استمرار استخدام رَوَاج بعد نشر التحديث موافقة على الشروط المعدلة.":
      "These terms may be updated as the platform or regulatory requirements evolve. We will publish the updated version and effective date, and continued use of RAWAJ after publication means acceptance of the revised terms.",
    "القانون المعمول به": "Applicable law",
    "تخضع هذه الشروط للقوانين والأنظمة السورية المعمول بها، وأي نزاع يُحلّ ودياً أولاً ثم وفق الاختصاص القانوني المحلي.":
      "These terms are governed by applicable Saudi laws and regulations. Disputes should first be resolved amicably, then by local jurisdiction.",
  };
  return labels[value] ?? value;
}
