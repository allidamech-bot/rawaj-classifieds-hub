import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "سياسة الخصوصية | رَوَاج" }] }),
  component: PrivacyPage,
});

const sections = [
  {
    h: "حالة المنصة الحالية",
    p: "رَوَاج ما زال في مرحلة تأسيس إنتاجية تدريجية. تسجيل الدخول والأدوار يعتمدان على مصدر بيانات آمن، بينما تبقى بعض أجزاء الصور والرسائل والدفع غير مكتملة أو تجريبية حتى تفعيل سياساتها.",
  },
  {
    h: "البيانات التي قد نجمعها لاحقاً",
    p: "عند تفعيل النسخة الكاملة، قد نجمع: بيانات الحساب (الاسم، البريد الإلكتروني، كلمة المرور المشفّرة)، بيانات التواصل (الهاتف، واتساب)، بيانات الإعلانات وصورها، الرسائل بين المستخدمين، المفضلة، عمليات البحث المحفوظة، البلاغات، طلبات الدعم، ومعلومات الجهاز/الجلسة لأغراض الأمان.",
  },
  {
    h: "كيف نستخدم البيانات",
    p: "لتشغيل المنصة، عرض الإعلانات للمستخدمين المناسبين، تسهيل التواصل بين البائع والمشتري، مكافحة الاحتيال، وتحسين تجربة الاستخدام. لن نبيع بياناتك لطرف ثالث.",
  },
  {
    h: "ظهور بيانات التواصل",
    p: "ستتمكن لاحقاً من التحكم بظهور رقم هاتفك أو واتساب أو إخفائهما، والسماح بالرسائل الداخلية فقط. الإعدادات ستكون متاحة في صفحة الحساب.",
  },
  {
    h: "تحكمك ببياناتك",
    p: "ستتمكن لاحقاً من تعديل بياناتك، حذف إعلاناتك، حظر مستخدمين، وحذف حسابك بالكامل وفق ضوابط واضحة.",
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
      <main className="container-wide pt-4 pb-8">
        <p className="mb-4 text-xs text-muted-foreground">
          {text(
            "هذه السياسة تعكس وضع المنصة حالياً (نسخة تجريبية) ومسارها المستقبلي.",
            "This policy reflects the current beta state of the platform and its expected path.",
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
    "حالة المنصة الحالية": "Current platform state",
    "رَوَاج ما زال في مرحلة تأسيس إنتاجية تدريجية. تسجيل الدخول والأدوار يعتمدان على مصدر بيانات آمن، بينما تبقى بعض أجزاء الصور والرسائل والدفع غير مكتملة أو تجريبية حتى تفعيل سياساتها.":
      "RAWAJ is still in gradual production foundation. Login and roles rely on a secure data source, while photos, messaging, and payment remain incomplete or demo-only until their policies are enabled.",
    "البيانات التي قد نجمعها لاحقاً": "Data we may collect later",
    "عند تفعيل النسخة الكاملة، قد نجمع: بيانات الحساب (الاسم، البريد الإلكتروني، كلمة المرور المشفّرة)، بيانات التواصل (الهاتف، واتساب)، بيانات الإعلانات وصورها، الرسائل بين المستخدمين، المفضلة، عمليات البحث المحفوظة، البلاغات، طلبات الدعم، ومعلومات الجهاز/الجلسة لأغراض الأمان.":
      "When the full version is enabled, we may collect account data, contact data, listing data and images, user messages, favorites, saved searches, reports, support requests, and device/session data for safety.",
    "كيف نستخدم البيانات": "How we use data",
    "لتشغيل المنصة، عرض الإعلانات للمستخدمين المناسبين، تسهيل التواصل بين البائع والمشتري، مكافحة الاحتيال، وتحسين تجربة الاستخدام. لن نبيع بياناتك لطرف ثالث.":
      "To operate the platform, show relevant listings, support buyer-seller communication, reduce fraud, and improve experience. We will not sell your data to third parties.",
    "ظهور بيانات التواصل": "Visibility of contact data",
    "ستتمكن لاحقاً من التحكم بظهور رقم هاتفك أو واتساب أو إخفائهما، والسماح بالرسائل الداخلية فقط. الإعدادات ستكون متاحة في صفحة الحساب.":
      "Later, you will control whether phone or WhatsApp are visible or hidden, and whether only internal messages are allowed.",
    "تحكمك ببياناتك": "Your data controls",
    "ستتمكن لاحقاً من تعديل بياناتك، حذف إعلاناتك، حظر مستخدمين، وحذف حسابك بالكامل وفق ضوابط واضحة.":
      "Later, you will be able to edit data, delete listings, block users, and delete your account under clear controls.",
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
