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
    p: "يعتمد رَوَاج على مصدر بيانات آمن للحسابات والأدوار، ويعرض بيانات المستخدم وفق ما يلزم لتشغيل الإعلانات والمراجعة والسلامة.",
  },
  {
    h: "البيانات التي نعالجها",
    p: "قد نعالج بيانات الحساب، بيانات التواصل التي تختار إظهارها، بيانات الإعلانات وصورها، الرسائل أو المفضلة أو عمليات البحث عند استخدامها، البلاغات، طلبات الدعم، ومعلومات الجهاز/الجلسة لأغراض الأمان.",
  },
  {
    h: "كيف نستخدم البيانات",
    p: "لتشغيل المنصة، عرض الإعلانات للمستخدمين المناسبين، تسهيل التواصل بين البائع والمشتري، مكافحة الاحتيال، وتحسين تجربة الاستخدام. لن نبيع بياناتك لطرف ثالث.",
  },
  {
    h: "ظهور بيانات التواصل",
    p: "يمكن ضبط ظهور رقم الهاتف أو واتساب أو تفضيل الرسائل الداخلية وفق إعدادات الحساب والإعلان.",
  },
  {
    h: "تحكمك ببياناتك",
    p: "يمكنك طلب تعديل بياناتك، حذف إعلاناتك، حظر مستخدمين، أو حذف حسابك وفق الضوابط المتاحة وسياسات الأمان.",
  },
  {
    h: "أمان البيانات",
    p: "سنطبّق إجراءات أمنية معقولة لحماية بياناتك بعد إطلاق النسخة الكاملة، بما يشمل التشفير وحدود الوصول. لا يوجد نظام كامل الحماية، ويبقى المستخدم مسؤولاً عن حماية كلمة المرور.",
  },
  {
    h: "ملفات الارتباط والتخزين المحلي",
    p: "قد نستخدم تخزيناً محلياً بسيطاً (Local Storage) في المتصفح لحفظ تفضيلات بسيطة مثل المحافظة المختارة أو وضع الواجهة. لا يتم استخدامه لتتبّع شخصي.",
  },
  {
    h: "البيانات المتعلقة بالأطفال",
    p: "المنصة مخصصة للبالغين. لا نقوم بجمع بيانات قاصرين عمداً.",
  },
  {
    h: "تعديل السياسة",
    p: "قد نقوم بتحديث هذه السياسة عند إطلاق النسخة الكاملة من رَوَاج. سيتم إعلام المستخدمين بأي تغيير جوهري.",
  },
  {
    h: "التواصل بخصوص الخصوصية",
    p: "لأي استفسار حول بياناتك يمكنك التواصل مع فريق رَوَاج عبر صفحة الدعم. سنرد على طلبات الخصوصية بعد تفعيل الخدمة الفعلية.",
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
            "هذه السياسة توضّح طريقة تعامل رَوَاج مع البيانات ضمن تجربة الاستخدام الحالية.",
            "This policy explains how RAWAJ handles data in the current product experience.",
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
    "يعتمد رَوَاج على مصدر بيانات آمن للحسابات والأدوار، ويعرض بيانات المستخدم وفق ما يلزم لتشغيل الإعلانات والمراجعة والسلامة.":
      "RAWAJ protects account access and shows user data only as needed for listings, review, and safety.",
    "البيانات التي نعالجها": "Data we process",
    "قد نعالج بيانات الحساب، بيانات التواصل التي تختار إظهارها، بيانات الإعلانات وصورها، الرسائل أو المفضلة أو عمليات البحث عند استخدامها، البلاغات، طلبات الدعم، ومعلومات الجهاز/الجلسة لأغراض الأمان.":
      "We may process account data, contact data you choose to show, listing data and images, messages, favorites or saved searches when used, reports, support requests, and device/session data for safety.",
    "كيف نستخدم البيانات": "How we use data",
    "لتشغيل المنصة، عرض الإعلانات للمستخدمين المناسبين، تسهيل التواصل بين البائع والمشتري، مكافحة الاحتيال، وتحسين تجربة الاستخدام. لن نبيع بياناتك لطرف ثالث.":
      "To operate the platform, show relevant listings, support buyer-seller communication, reduce fraud, and improve experience. We will not sell your data to third parties.",
    "ظهور بيانات التواصل": "Visibility of contact data",
    "يمكن ضبط ظهور رقم الهاتف أو واتساب أو تفضيل الرسائل الداخلية وفق إعدادات الحساب والإعلان.":
      "Phone, WhatsApp, or internal-message preferences can be controlled through account and listing settings.",
    "تحكمك ببياناتك": "Your data controls",
    "يمكنك طلب تعديل بياناتك، حذف إعلاناتك، حظر مستخدمين، أو حذف حسابك وفق الضوابط المتاحة وسياسات الأمان.":
      "You can request data edits, listing removal, user blocking, or account deletion under available controls and safety policies.",
    "أمان البيانات": "Data security",
    "سنطبّق إجراءات أمنية معقولة لحماية بياناتك بعد إطلاق النسخة الكاملة، بما يشمل التشفير وحدود الوصول. لا يوجد نظام كامل الحماية، ويبقى المستخدم مسؤولاً عن حماية كلمة المرور.":
      "We will apply reasonable security controls after full launch, including encryption and access limits. No system is perfectly secure, and users remain responsible for protecting passwords.",
    "ملفات الارتباط والتخزين المحلي": "Cookies and local storage",
    "قد نستخدم تخزيناً محلياً بسيطاً (Local Storage) في المتصفح لحفظ تفضيلات بسيطة مثل المحافظة المختارة أو وضع الواجهة. لا يتم استخدامه لتتبّع شخصي.":
      "We may use simple browser local storage for preferences such as selected governorate or interface mode. It is not used for personal tracking.",
    "البيانات المتعلقة بالأطفال": "Children's data",
    "المنصة مخصصة للبالغين. لا نقوم بجمع بيانات قاصرين عمداً.":
      "The platform is intended for adults. We do not knowingly collect data from minors.",
    "تعديل السياسة": "Policy changes",
    "قد نقوم بتحديث هذه السياسة عند إطلاق النسخة الكاملة من رَوَاج. سيتم إعلام المستخدمين بأي تغيير جوهري.":
      "We may update this policy when RAWAJ's full version launches. Material changes will be communicated.",
    "التواصل بخصوص الخصوصية": "Privacy contact",
    "لأي استفسار حول بياناتك يمكنك التواصل مع فريق رَوَاج عبر صفحة الدعم. سنرد على طلبات الخصوصية بعد تفعيل الخدمة الفعلية.":
      "For data questions, contact RAWAJ through support. Privacy requests will be handled after the service is fully enabled.",
  };
  return labels[value] ?? value;
}
