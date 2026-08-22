import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, LockKeyhole, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/privacy")({
  head: () =>
    createSeo({
      title: "سياسة الخصوصية | RAWAJ / رواج",
      description:
        "سياسة خصوصية رواج بشأن الحسابات والإعلانات والمحادثات وطلبات التوثيق والبلاغات وحقوق أصحاب البيانات وحماية المعلومات.",
      path: "/privacy",
    }),
  component: PrivacyPage,
});

type Section = { arTitle: string; enTitle: string; arBody: string; enBody: string };

const sections: Section[] = [
  {
    arTitle: "1. نطاق السياسة",
    enTitle: "1. Scope",
    arBody:
      "توضح هذه السياسة كيفية تعامل رواج مع البيانات الشخصية عند استخدام الموقع أو التطبيق أو الحساب أو الإعلانات أو المحادثات أو التوثيق أو البلاغات أو الدعم. تسري على الزوار والمستخدمين والمعلنين والبائعين والمشترين وكل من يرسل بيانات إلى المنصة.",
    enBody:
      "This policy explains how RAWAJ handles personal data when you use the website, app, account, listings, messaging, verification, reports, or support. It applies to visitors, users, advertisers, sellers, buyers, and anyone who submits data to the platform.",
  },
  {
    arTitle: "2. البيانات التي نعالجها",
    enTitle: "2. Data we process",
    arBody:
      "قد نعالج بيانات الحساب والاسم والبريد الإلكتروني ووسائل التواصل التي تختار إضافتها، بيانات الملف الشخصي والمتجر، الإعلانات والصور والموقع المختار، المفضلة والبحث، المحادثات والمرفقات، البلاغات وطلبات الدعم، سجل النشاط والجلسات، ومعلومات تقنية وأمنية مثل نوع الجهاز والمتصفح وعنوان الشبكة وسجلات الأخطاء والحماية عند الحاجة.",
    enBody:
      "We may process account details, name, email, contact methods you choose to add, profile and store data, listings, images and selected location, favorites and searches, messages and attachments, reports and support requests, activity and session records, and technical or security data such as device, browser, network address, error logs, and security events where needed.",
  },
  {
    arTitle: "3. وثائق التوثيق والبيانات الحساسة",
    enTitle: "3. Verification documents and sensitive data",
    arBody:
      "وثائق التوثيق تعامل كبيانات خاصة ولا تُعرض في الملف العام أو الإعلان. تحفظ في مساحة خاصة وتتاح فقط للأنظمة والموظفين أو المسؤولين المخولين بالمراجعة بالقدر اللازم. لا ترسل وثائق هوية أو بيانات بنكية أو رموز تحقق داخل إعلان عام أو محادثة عادية ما لم تطلب المنصة ذلك صراحة عبر مسار آمن مخصص.",
    enBody:
      "Verification documents are treated as private data and are not shown on public profiles or listings. They are stored privately and made available only to authorized systems and reviewers as necessary. Do not send identity documents, banking information, or verification codes through public listings or ordinary messages unless RAWAJ explicitly requests them through a dedicated secure flow.",
  },
  {
    arTitle: "4. مصادر البيانات",
    enTitle: "4. Sources",
    arBody:
      "نحصل على البيانات منك مباشرة عند التسجيل أو تعديل الحساب أو نشر إعلان أو التواصل أو إرسال طلب توثيق أو بلاغ. وقد تنتج بيانات تقنية تلقائياً عند استخدام الخدمة. وإذا استخدمت مزود تسجيل دخول خارجي فقد نستلم منه بيانات الحساب الأساسية التي سمحت بمشاركتها.",
    enBody:
      "We receive data directly from you when you register, edit your account, post a listing, communicate, submit verification, or file a report. Technical data may also be generated automatically when you use the service. If you use an external sign-in provider, we may receive basic account data you authorized it to share.",
  },
  {
    arTitle: "5. أغراض المعالجة",
    enTitle: "5. Purposes of processing",
    arBody:
      "نستخدم البيانات لتشغيل الحسابات والإعلانات والبحث والمحادثات، إظهار بيانات الاتصال التي اخترت نشرها، مراجعة المحتوى، تنفيذ التوثيق، منع الاحتيال وإساءة الاستخدام، حماية الحسابات، معالجة البلاغات والدعم، حفظ الأدلة عند النزاعات أو المخالفات، قياس الأداء وتحسين الخدمة، والامتثال للمتطلبات القانونية أو الطلبات الرسمية المشروعة عند انطباقها.",
    enBody:
      "We use data to operate accounts, listings, search, and messaging; display contact details you choose to publish; moderate content; perform verification; prevent fraud and abuse; protect accounts; handle reports and support; preserve evidence for disputes or violations; measure and improve the service; and comply with applicable legal obligations or lawful official requests.",
  },
  {
    arTitle: "6. الأساس النظامي والموافقة",
    enTitle: "6. Lawful basis and consent",
    arBody:
      "تتم المعالجة وفق الأساس القانوني أو النظامي المناسب للغرض، مثل تنفيذ الخدمة التي طلبتها، حماية المنصة والمستخدمين، الوفاء بالتزام قانوني، أو الموافقة عندما تكون مطلوبة. إذا كانت معالجة معينة قائمة على الموافقة، فيمكن سحبها وفق الضوابط المطبقة دون أن يؤثر ذلك على المعالجة التي تمت بصورة مشروعة قبل السحب.",
    enBody:
      "Processing relies on the lawful basis appropriate to the purpose, such as providing a requested service, protecting the platform and users, meeting a legal obligation, or consent where required. Where processing relies on consent, it may be withdrawn subject to applicable rules without affecting processing that was lawful before withdrawal.",
  },
  {
    arTitle: "7. البيانات العامة وبيانات الاتصال",
    enTitle: "7. Public and contact data",
    arBody:
      "أي معلومات تختار نشرها في ملفك أو متجرك أو إعلانك قد تصبح متاحة للزوار أو المستخدمين الآخرين. أنت مسؤول عن عدم نشر معلومات لا تريد إتاحتها للعامة. لا تنشر كلمات مرور أو رموز تحقق أو بيانات بطاقات أو وثائق هوية أو معلومات حساسة تخصك أو تخص الغير.",
    enBody:
      "Information you choose to publish on your profile, store, or listing may be visible to visitors or other users. You are responsible for not publishing information you want kept private. Never publish passwords, verification codes, payment-card details, identity documents, or sensitive data about yourself or others.",
  },
  {
    arTitle: "8. المحادثات والبلاغات وحفظ الأدلة",
    enTitle: "8. Messages, reports, and evidence preservation",
    arBody:
      "قد تحفظ المحادثات والبلاغات والسجلات المرتبطة بها لتشغيل الخدمة، حماية المستخدمين، التحقيق في إساءة الاستخدام، الرد على الشكاوى، أو حفظ دليل لازم لنزاع أو التزام قانوني. قد تُقيّد إمكانية حذف بعض السجلات فوراً إذا كان الاحتفاظ بها ضرورياً بشكل مشروع لهذه الأغراض.",
    enBody:
      "Messages, reports, and related records may be retained to operate the service, protect users, investigate abuse, respond to complaints, or preserve evidence required for a dispute or legal obligation. Immediate deletion of some records may be restricted where lawful retention is necessary for those purposes.",
  },
  {
    arTitle: "9. مزودو الخدمات والنقل",
    enTitle: "9. Service providers and transfers",
    arBody:
      "قد نستخدم مزودي خدمات للاستضافة والتخزين وإدارة الهوية والأمان والإشعارات والقياس والبنية التحتية. يحصل كل مزود على البيانات بالقدر اللازم لتقديم خدمته. وإذا تضمنت الخدمة معالجة أو نقلاً عبر حدود دولة، نتعامل معه وفق المتطلبات القانونية والضمانات المطبقة وبالقدر الضروري لتشغيل الخدمة.",
    enBody:
      "We may use providers for hosting, storage, identity, security, notifications, analytics, and infrastructure. Each provider receives data only as necessary for its service. Where processing involves cross-border handling or transfers, we apply the legal requirements and safeguards applicable to the service and limit processing to what is necessary.",
  },
  {
    arTitle: "10. عدم بيع البيانات",
    enTitle: "10. No sale of personal data",
    arBody:
      "رواج لا يبيع البيانات الشخصية للمعلنين أو الوسطاء. وقد نستخدم بيانات مجمعة أو منزوعة الارتباط بالهوية لأغراض القياس والتحسين بشرط ألا تكون مصممة للتعرف على شخص بعينه.",
    enBody:
      "RAWAJ does not sell personal data to advertisers or data brokers. Aggregated or de-identified information may be used for measurement and improvement where it is not designed to identify a specific person.",
  },
  {
    arTitle: "11. الأمان",
    enTitle: "11. Security",
    arBody:
      "نطبق تدابير تقنية وتنظيمية معقولة مثل الاتصالات المشفرة، التحكم في الوصول، الفصل بين البيانات العامة والخاصة، وحماية الجلسات والسجلات. لا توجد وسيلة تقنية تضمن أماناً مطلقاً؛ لذلك يجب حماية جهازك وكلمة مرورك ورموز التحقق وإبلاغ الدعم فوراً عند الاشتباه باختراق الحساب.",
    enBody:
      "We apply reasonable technical and organizational measures such as encrypted transport, access controls, separation of public and private data, and session and log protections. No system can guarantee absolute security, so you must protect your device, password, and verification codes and contact support promptly if you suspect account compromise.",
  },
  {
    arTitle: "12. مدة الاحتفاظ والحذف",
    enTitle: "12. Retention and deletion",
    arBody:
      "نحتفظ بالبيانات للمدة اللازمة للغرض الذي جمعت من أجله أو لتشغيل الحساب أو منع الاحتيال أو حماية الحقوق أو تنفيذ التزامات قانونية. بعد انتهاء الحاجة، تُحذف البيانات أو تُتلف أو تُفصل عن الهوية عندما يكون ذلك مناسباً. قد تستمر بعض سجلات الأمان أو المعاملات أو البلاغات مدة أطول إذا كان الاحتفاظ بها مطلوباً أو مشروعاً.",
    enBody:
      "We retain data for as long as needed for its purpose, account operation, fraud prevention, protection of rights, or legal obligations. When it is no longer needed, data is deleted, destroyed, or de-identified as appropriate. Security, transaction, or report records may be retained longer where required or lawfully justified.",
  },
  {
    arTitle: "13. حقوقك وطلباتك",
    enTitle: "13. Your rights and requests",
    arBody:
      "بحسب القوانين المطبقة، قد تشمل حقوقك العلم بالمعالجة والوصول إلى بياناتك وطلب نسخة أو تصحيح أو تحديث أو حذف أو تقييد بعض المعالجة والاعتراض أو سحب الموافقة حيث ينطبق ذلك. قد نحتاج للتحقق من الهوية قبل تنفيذ الطلب، وقد توجد استثناءات قانونية تمنع الحذف الفوري لبعض السجلات.",
    enBody:
      "Depending on applicable law, your rights may include information about processing, access, a copy of your data, correction, updating, deletion, restriction of certain processing, objection, or withdrawal of consent where applicable. We may verify identity before acting on a request, and legal exceptions may prevent immediate deletion of certain records.",
  },
  {
    arTitle: "14. الأطفال والقاصرون",
    enTitle: "14. Children and minors",
    arBody:
      "الخدمات التي تتطلب قدرة قانونية على البيع أو الشراء أو التعاقد يجب ألا تستخدم بصورة مستقلة من شخص غير مكتمل الأهلية. عند الحاجة يجب أن يتم الاستخدام تحت إشراف وموافقة الولي أو الممثل القانوني وفق القوانين المطبقة.",
    enBody:
      "Services requiring legal capacity to sell, buy, or contract should not be used independently by a person lacking full legal capacity. Where required, use must occur under the supervision and consent of a lawful guardian or representative under applicable law.",
  },
  {
    arTitle: "15. الإفصاح القانوني والطلبات الرسمية",
    enTitle: "15. Legal disclosure and official requests",
    arBody:
      "قد نفصح عن بيانات بالقدر الضروري إذا كان ذلك مطلوباً بموجب قانون نافذ أو أمر قضائي أو طلب رسمي مشروع، أو عند الحاجة لحماية المستخدمين أو حقوق المنصة أو منع جريمة أو احتيال، مع مراعاة حدود الصلاحية والمتطلبات القانونية المطبقة.",
    enBody:
      "We may disclose data to the extent necessary where required by applicable law, court order, or lawful official request, or where needed to protect users or platform rights or to prevent crime or fraud, subject to applicable authority and legal requirements.",
  },
  {
    arTitle: "16. تحديث السياسة والتواصل",
    enTitle: "16. Policy updates and contact",
    arBody:
      "قد نحدث هذه السياسة عند تغير الخدمة أو المتطلبات القانونية أو الأمنية. يُعرض تاريخ آخر تحديث في الصفحة. للاستفسار أو طلب متعلق بالخصوصية استخدم صفحة الدعم، ولا ترسل وثائق حساسة في نص الطلب إلا إذا طلبها فريق رواج عبر مسار مخصص.",
    enBody:
      "We may update this policy when the service or legal or security requirements change. The page shows the latest update date. For privacy questions or requests, use the support page and do not include sensitive documents in free-text support messages unless RAWAJ requests them through a dedicated flow.",
  },
];

function PrivacyPage() {
  const { text } = useUiPreferences();
  return (
    <>
      <PageHeader title={text("سياسة الخصوصية", "Privacy Policy")} />
      <main className="rawaj-legal-v3 container-wide mobile-page-bottom space-y-4 pb-8 pt-4">
        <section className="rounded-2xl bg-card p-5 hairline">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-extrabold">
                {text("خصوصيتك جزء من أمان المنصة", "Privacy is part of platform safety")}
              </h1>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {text(
                  "آخر تحديث: 15 أغسطس 2026. هذه السياسة تُقرأ مع شروط الاستخدام وسياسات الأمان والمحتوى المحظور.",
                  "Last updated: 15 August 2026. This policy should be read with the Terms of Use, safety guidance, and prohibited-content rules.",
                )}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-warning/10 p-4 hairline">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <p className="text-xs leading-6 text-warning">
              {text(
                "تنبيه: لا ترسل كلمة مرور أو رمز تحقق أو بيانات بطاقة أو نسخة هوية داخل إعلان عام أو محادثة. مسار التوثيق المخصص هو المكان الوحيد المخصص لوثائق التوثيق.",
                "Warning: never send passwords, verification codes, card details, or identity copies in a public listing or ordinary message. The dedicated verification flow is the only intended place for verification documents.",
              )}
            </p>
          </div>
        </section>

        <div className="grid gap-3">
          {sections.map((section) => (
            <section key={section.enTitle} className="rounded-2xl bg-card p-4 hairline">
              <h2 className="text-sm font-extrabold">{text(section.arTitle, section.enTitle)}</h2>
              <p className="mt-2 text-xs leading-7 text-muted-foreground">
                {text(section.arBody, section.enBody)}
              </p>
            </section>
          ))}
        </div>

        <section className="rounded-2xl bg-card p-4 hairline">
          <div className="flex items-center gap-2 text-xs font-bold">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            {text("روابط مرتبطة", "Related policies")}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Link to="/terms" className="rounded-xl bg-muted-surface px-3 py-2 font-bold hairline">
              {text("شروط الاستخدام", "Terms of Use")}
            </Link>
            <Link to="/safety" className="rounded-xl bg-muted-surface px-3 py-2 font-bold hairline">
              {text("إرشادات الأمان", "Safety guidance")}
            </Link>
            <Link
              to="/prohibited"
              className="rounded-xl bg-muted-surface px-3 py-2 font-bold hairline"
            >
              {text("المحتوى المحظور", "Prohibited content")}
            </Link>
            <Link
              to="/support"
              className="rounded-xl bg-primary px-3 py-2 font-bold text-primary-foreground"
            >
              {text("طلب خصوصية أو دعم", "Privacy or support request")}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
