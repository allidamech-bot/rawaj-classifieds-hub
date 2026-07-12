import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { createSeo } from "@/lib/seo";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";

export const Route = createFileRoute("/privacy")({
  head: () =>
    createSeo({
      title: "سياسة الخصوصية | RAWAJ / رواج",
      description:
        "تعرف على كيفية تعامل رواج مع بيانات الحسابات والإعلانات والرسائل والبلاغات وطلبات الدعم ضمن تجربة السوق المبوب.",
      path: "/privacy",
    }),
  component: PrivacyPage,
});

const sections = [
  {
    h: "خصوصية رَوَاج",
    p: "يعتمد رَوَاج على أنظمة آمنة لإدارة الحسابات والصلاحيات، ولا يعرض بيانات المستخدم إلا بالقدر اللازم لتشغيل الإعلانات والمراجعة والتواصل والسلامة.",
  },
  {
    h: "البيانات التي نعالجها",
    p: "قد نعالج بيانات الحساب، بيانات التواصل التي تختار إظهارها، بيانات الإعلانات وصورها، الرسائل أو المفضلة أو عمليات البحث عند استخدامها، البلاغات، طلبات الدعم، ومعلومات الجهاز أو الجلسة لأغراض التشغيل والأمان.",
  },
  {
    h: "كيف نستخدم البيانات",
    p: "نستخدم البيانات لتشغيل المنصة، عرض الإعلانات المناسبة، تسهيل التواصل بين البائع والمشتري، مكافحة الاحتيال، معالجة البلاغات وطلبات الدعم، وتحسين تجربة الاستخدام. لا نبيع بياناتك الشخصية لأطراف ثالثة.",
  },
  {
    h: "ظهور بيانات التواصل",
    p: "يمكن ضبط ظهور رقم الهاتف أو واتساب أو تفضيل الرسائل الداخلية وفق إعدادات الحساب والإعلان. أنت مسؤول عن المعلومات التي تختار نشرها علناً داخل إعلانك.",
  },
  {
    h: "تحكمك ببياناتك",
    p: "يمكنك تعديل بيانات حسابك المتاحة، حذف إعلاناتك وفق حالتها، حظر مستخدمين، أو تقديم طلب لحذف حسابك. قد نحتفظ ببعض السجلات عند الحاجة للامتثال أو الأمان أو منع إساءة الاستخدام.",
  },
  {
    h: "أمان البيانات",
    p: "نستخدم إجراءات تقنية وتنظيمية معقولة لحماية البيانات، بما في ذلك الاتصالات المشفرة وحدود الوصول والصلاحيات. لا يوجد نظام آمن بالكامل، ويبقى المستخدم مسؤولاً عن حماية كلمة مروره وجهازه.",
  },
  {
    h: "ملفات الارتباط والتخزين المحلي",
    p: "قد نستخدم ملفات ارتباط أو تخزيناً محلياً في المتصفح لحفظ الجلسة والتفضيلات الضرورية، مثل اللغة أو المحافظة المختارة أو وضع الواجهة، ولتشغيل خصائص الأمان. قد تستخدم خدمات القياس المفعلة بيانات تقنية مجمعة لتحسين الأداء.",
  },
  {
    h: "البيانات المتعلقة بالأطفال",
    p: "المنصة مخصصة للبالغين القادرين قانوناً على استخدام خدمات الإعلانات المبوبة. لا نجمع عن علم بيانات شخصية من أطفال، ويمكن الإبلاغ عن أي حساب أو محتوى يثير هذا القلق عبر صفحة الدعم.",
  },
  {
    h: "تعديل السياسة",
    p: "قد نحدّث هذه السياسة مع تطور المنصة أو المتطلبات التنظيمية. سننشر النسخة المحدثة وتاريخ سريانها، وقد نعرض إشعاراً إضافياً عند وجود تغيير جوهري.",
  },
  {
    h: "التواصل بخصوص الخصوصية",
    p: "لأي استفسار أو طلب يتعلق ببياناتك، تواصل مع فريق رَوَاج عبر صفحة الدعم. تتم مراجعة طلبات الخصوصية والتحقق من هوية صاحب الحساب قبل تنفيذ الإجراءات الحساسة.",
  },
];

function PrivacyPage() {
  const { language, text } = useUiPreferences();

  return (
    <>
      <PageHeader title={text("سياسة الخصوصية", "Privacy policy")} />
      <main className="container-wide mobile-page-bottom pt-4">
        <p className="mb-4 text-xs text-muted-foreground">
          {text(
            "آخر تحديث: 12 تموز 2026. توضّح هذه السياسة كيفية تعامل رَوَاج مع البيانات أثناء تشغيل المنصة.",
            "Last updated: July 12, 2026. This policy explains how RAWAJ handles data while operating the platform.",
          )}
        </p>
        <div className="space-y-3">
          {sections.map((s, i) => (
            <section key={i} className="rounded-2xl bg-card p-4 hairline">
              <h2 className="mb-2 text-base font-extrabold text-foreground">
                {i + 1}. {privacyText(s.h, language)}
              </h2>
              <p className="text-sm leading-7 text-foreground/90">{privacyText(s.p, language)}</p>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}

function privacyText(value: string, language: Language) {
  if (language === "ar") return value;
  const labels: Record<string, string> = {
    "خصوصية رَوَاج": "RAWAJ privacy",
    "يعتمد رَوَاج على أنظمة آمنة لإدارة الحسابات والصلاحيات، ولا يعرض بيانات المستخدم إلا بالقدر اللازم لتشغيل الإعلانات والمراجعة والتواصل والسلامة.":
      "RAWAJ uses secure systems to manage accounts and permissions and shows user data only as needed for listings, moderation, communication, and safety.",
    "البيانات التي نعالجها": "Data we process",
    "قد نعالج بيانات الحساب، بيانات التواصل التي تختار إظهارها، بيانات الإعلانات وصورها، الرسائل أو المفضلة أو عمليات البحث عند استخدامها، البلاغات، طلبات الدعم، ومعلومات الجهاز أو الجلسة لأغراض التشغيل والأمان.":
      "We may process account data, contact data you choose to show, listing data and images, messages, favorites or saved searches when used, reports, support requests, and device or session data for operation and safety.",
    "كيف نستخدم البيانات": "How we use data",
    "نستخدم البيانات لتشغيل المنصة، عرض الإعلانات المناسبة، تسهيل التواصل بين البائع والمشتري، مكافحة الاحتيال، معالجة البلاغات وطلبات الدعم، وتحسين تجربة الاستخدام. لا نبيع بياناتك الشخصية لأطراف ثالثة.":
      "We use data to operate the platform, show relevant listings, support buyer-seller communication, reduce fraud, handle reports and support requests, and improve the experience. We do not sell your personal data to third parties.",
    "ظهور بيانات التواصل": "Visibility of contact data",
    "يمكن ضبط ظهور رقم الهاتف أو واتساب أو تفضيل الرسائل الداخلية وفق إعدادات الحساب والإعلان. أنت مسؤول عن المعلومات التي تختار نشرها علناً داخل إعلانك.":
      "Phone, WhatsApp, or internal-message preferences can be controlled through account and listing settings. You are responsible for information you choose to publish publicly in a listing.",
    "تحكمك ببياناتك": "Your data controls",
    "يمكنك تعديل بيانات حسابك المتاحة، حذف إعلاناتك وفق حالتها، حظر مستخدمين، أو تقديم طلب لحذف حسابك. قد نحتفظ ببعض السجلات عند الحاجة للامتثال أو الأمان أو منع إساءة الاستخدام.":
      "You can edit available account data, remove listings according to their status, block users, or submit an account-deletion request. Some records may be retained when needed for compliance, safety, or abuse prevention.",
    "أمان البيانات": "Data security",
    "نستخدم إجراءات تقنية وتنظيمية معقولة لحماية البيانات، بما في ذلك الاتصالات المشفرة وحدود الوصول والصلاحيات. لا يوجد نظام آمن بالكامل، ويبقى المستخدم مسؤولاً عن حماية كلمة مروره وجهازه.":
      "We use reasonable technical and organizational safeguards, including encrypted connections and access controls. No system is completely secure, and users remain responsible for protecting their passwords and devices.",
    "ملفات الارتباط والتخزين المحلي": "Cookies and local storage",
    "قد نستخدم ملفات ارتباط أو تخزيناً محلياً في المتصفح لحفظ الجلسة والتفضيلات الضرورية، مثل اللغة أو المحافظة المختارة أو وضع الواجهة، ولتشغيل خصائص الأمان. قد تستخدم خدمات القياس المفعلة بيانات تقنية مجمعة لتحسين الأداء.":
      "We may use cookies or browser local storage to maintain sessions and necessary preferences such as language, selected governorate, or interface mode, and to operate security features. Enabled analytics services may use aggregated technical data to improve performance.",
    "البيانات المتعلقة بالأطفال": "Children's data",
    "المنصة مخصصة للبالغين القادرين قانوناً على استخدام خدمات الإعلانات المبوبة. لا نجمع عن علم بيانات شخصية من أطفال، ويمكن الإبلاغ عن أي حساب أو محتوى يثير هذا القلق عبر صفحة الدعم.":
      "The platform is intended for adults legally able to use classified-ad services. We do not knowingly collect children's personal data, and concerns can be reported through the support page.",
    "تعديل السياسة": "Policy changes",
    "قد نحدّث هذه السياسة مع تطور المنصة أو المتطلبات التنظيمية. سننشر النسخة المحدثة وتاريخ سريانها، وقد نعرض إشعاراً إضافياً عند وجود تغيير جوهري.":
      "We may update this policy as the platform or regulatory requirements evolve. We will publish the updated version and its effective date and may provide an additional notice for material changes.",
    "التواصل بخصوص الخصوصية": "Privacy contact",
    "لأي استفسار أو طلب يتعلق ببياناتك، تواصل مع فريق رَوَاج عبر صفحة الدعم. تتم مراجعة طلبات الخصوصية والتحقق من هوية صاحب الحساب قبل تنفيذ الإجراءات الحساسة.":
      "For questions or requests about your data, contact RAWAJ through the support page. Privacy requests are reviewed and account ownership is verified before sensitive actions are taken.",
  };
  return labels[value] ?? value;
}
