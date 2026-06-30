import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "شروط الاستخدام | رَوَاج" }] }),
  component: TermsPage,
});

const sections = [
  {
    h: "طبيعة المنصة",
    p: "رَوَاج منصة إعلانات مبوّبة مجانية موجّهة للمستخدمين داخل الجمهورية العربية السورية، تُتيح للأفراد والمتاجر نشر إعلاناتهم وعرض سلعهم وخدماتهم. المنصة حالياً بنسخة تجريبية، ولا تتم فيها أي عملية بيع أو شراء أو دفع مباشر.",
  },
  {
    h: "الاستخدام المقبول",
    p: "يلتزم المستخدمون باستخدام رَوَاج بطريقة قانونية ومسؤولة، واحترام القوانين المحلية، والامتناع عن أي محتوى مسيء أو احتيالي أو مخالف للآداب العامة.",
  },
  {
    h: "مجانية النشر",
    p: "نشر الإعلانات وتصفّحها مجانيان بالكامل. قد تتوفر خدمات ترويج اختيارية مدفوعة لاحقاً، وسيتم الإعلان عنها بوضوح قبل تفعيلها.",
  },
  {
    h: "مسؤولية المستخدم عن محتوى الإعلان",
    p: "يتحمل المستخدم وحده كامل المسؤولية القانونية والمعنوية عن محتوى إعلاناته، وصحة الصور والمواصفات والأسعار والمعلومات الواردة فيها.",
  },
  {
    h: "عدم ضمان التعاملات",
    p: "لا يضمن رَوَاج نتائج أي تعامل بين المستخدمين، ولا يتحمل مسؤولية جودة السلع أو الخدمات أو صحة الادعاءات أو موثوقية البائع/المشتري.",
  },
  {
    h: "الإعلانات الممنوعة",
    p: "يُحظر نشر إعلانات تخالف القوانين السورية، أو تتعلق بالأسلحة، المخدرات، المسروقات، الاحتيال، أو أي محتوى ممنوع. راجع صفحة (الإعلانات الممنوعة) للقائمة الكاملة.",
  },
  {
    h: "التواصل بين المستخدمين",
    p: "يتم التواصل بين البائع والمشتري على مسؤوليتهما. لا يتدخل رَوَاج في تفاصيل المفاوضة أو الدفع أو التسليم.",
  },
  {
    h: "البلاغات والإشراف",
    p: "يتم تجهيز منظومة بلاغات وإشراف مرتبطة بمصدر البيانات التشغيلي، لكن تنفيذ الإجراءات الإدارية الكاملة يبقى خاضعاً للصلاحيات والسياسات عند التفعيل.",
  },
  {
    h: "تعليق وإلغاء الحساب",
    p: "يحق لرَوَاج لاحقاً تعليق أو إلغاء أي حساب يثبت تكرار مخالفته للشروط، مع الاحتفاظ بالبيانات وفق سياسة الخصوصية.",
  },
  {
    h: "حدود النسخة التجريبية",
    p: "تم تجهيز أساس تسجيل الدخول والأدوار، بينما ما زالت بعض أجزاء الصور والرسائل والدفع في مراحل تأسيس أو عرض تجريبي حتى اكتمال السياسات المطلوبة.",
  },
  {
    h: "تعديل الشروط",
    p: "قد يتم تحديث هذه الشروط لاحقاً مع تطوّر المنصة. استمرار استخدامك للتطبيق يعتبر موافقة على النسخة المحدّثة.",
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
      <main className="container-wide pt-4 pb-8">
        <p className="mb-4 text-xs text-muted-foreground">
          {text(
            "آخر تحديث: نسخة تجريبية. قد يتم تعديل النص لاحقاً عند الإطلاق الرسمي.",
            "Last updated: beta version. This text may change before official launch.",
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
    "رَوَاج منصة إعلانات مبوّبة مجانية موجّهة للمستخدمين داخل الجمهورية العربية السورية، تُتيح للأفراد والمتاجر نشر إعلاناتهم وعرض سلعهم وخدماتهم. المنصة حالياً بنسخة تجريبية، ولا تتم فيها أي عملية بيع أو شراء أو دفع مباشر.":
      "RAWAJ is a free classifieds platform for users in Syria, allowing individuals and stores to publish listings for goods and services. The platform is currently beta and does not directly process sales, purchases, or payments.",
    "الاستخدام المقبول": "Acceptable use",
    "يلتزم المستخدمون باستخدام رَوَاج بطريقة قانونية ومسؤولة، واحترام القوانين المحلية، والامتناع عن أي محتوى مسيء أو احتيالي أو مخالف للآداب العامة.":
      "Users must use RAWAJ lawfully and responsibly, respect local laws, and avoid abusive, fraudulent, or inappropriate content.",
    "مجانية النشر": "Free posting",
    "نشر الإعلانات وتصفّحها مجانيان بالكامل. قد تتوفر خدمات ترويج اختيارية مدفوعة لاحقاً، وسيتم الإعلان عنها بوضوح قبل تفعيلها.":
      "Posting and browsing are free. Optional paid promotion services may be offered later and will be clearly announced before activation.",
    "مسؤولية المستخدم عن محتوى الإعلان": "User responsibility for listing content",
    "يتحمل المستخدم وحده كامل المسؤولية القانونية والمعنوية عن محتوى إعلاناته، وصحة الصور والمواصفات والأسعار والمعلومات الواردة فيها.":
      "The user is solely responsible for listing content, including the accuracy of photos, specifications, prices, and information.",
    "عدم ضمان التعاملات": "No transaction guarantee",
    "لا يضمن رَوَاج نتائج أي تعامل بين المستخدمين، ولا يتحمل مسؤولية جودة السلع أو الخدمات أو صحة الادعاءات أو موثوقية البائع/المشتري.":
      "RAWAJ does not guarantee outcomes between users and is not responsible for item or service quality, claims, or buyer/seller reliability.",
    "الإعلانات الممنوعة": "Prohibited listings",
    "يُحظر نشر إعلانات تخالف القوانين السورية، أو تتعلق بالأسلحة، المخدرات، المسروقات، الاحتيال، أو أي محتوى ممنوع. راجع صفحة (الإعلانات الممنوعة) للقائمة الكاملة.":
      "Listings that violate Syrian law or involve weapons, drugs, stolen goods, fraud, or other prohibited content are not allowed. See the Prohibited page for the full list.",
    "التواصل بين المستخدمين": "User communication",
    "يتم التواصل بين البائع والمشتري على مسؤوليتهما. لا يتدخل رَوَاج في تفاصيل المفاوضة أو الدفع أو التسليم.":
      "Buyer-seller communication is their responsibility. RAWAJ does not intervene in negotiation, payment, or delivery details.",
    "البلاغات والإشراف": "Reports and moderation",
    "يتم تجهيز منظومة بلاغات وإشراف مرتبطة بمصدر البيانات التشغيلي، لكن تنفيذ الإجراءات الإدارية الكاملة يبقى خاضعاً للصلاحيات والسياسات عند التفعيل.":
      "Reporting and moderation are being prepared against the operational data source, but full admin actions depend on permissions and policies when activated.",
    "تعليق وإلغاء الحساب": "Account suspension and removal",
    "يحق لرَوَاج لاحقاً تعليق أو إلغاء أي حساب يثبت تكرار مخالفته للشروط، مع الاحتفاظ بالبيانات وفق سياسة الخصوصية.":
      "RAWAJ may later suspend or remove accounts with repeated violations, while retaining data according to the privacy policy.",
    "حدود النسخة التجريبية": "Beta limitations",
    "تم تجهيز أساس تسجيل الدخول والأدوار، بينما ما زالت بعض أجزاء الصور والرسائل والدفع في مراحل تأسيس أو عرض تجريبي حتى اكتمال السياسات المطلوبة.":
      "Login and role foundations exist, while images, messages, and payment remain foundational or demo surfaces until required policies are complete.",
    "تعديل الشروط": "Changes to terms",
    "قد يتم تحديث هذه الشروط لاحقاً مع تطوّر المنصة. استمرار استخدامك للتطبيق يعتبر موافقة على النسخة المحدّثة.":
      "These terms may be updated as the platform evolves. Continued use means acceptance of the updated version.",
    "القانون المعمول به": "Applicable law",
    "تخضع هذه الشروط للقوانين والأنظمة السورية المعمول بها، وأي نزاع يُحلّ ودياً أولاً ثم وفق الاختصاص القانوني المحلي.":
      "These terms are governed by applicable Syrian laws and regulations. Disputes should first be resolved amicably, then by local jurisdiction.",
  };
  return labels[value] ?? value;
}
