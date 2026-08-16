import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Scale, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/terms")({
  head: () =>
    createSeo({
      title: "شروط وسياسة الاستخدام | RAWAJ / رواج",
      description:
        "شروط وسياسة استخدام رواج للحسابات والإعلانات والتواصل والتوثيق والبلاغات والمحتوى المحظور وحدود دور المنصة.",
      path: "/terms",
    }),
  component: TermsPage,
});

type Section = { arTitle: string; enTitle: string; arBody: string; enBody: string };

const sections: Section[] = [
  {
    arTitle: "1. قبول الشروط",
    enTitle: "1. Acceptance",
    arBody:
      "باستخدام رواج أو إنشاء حساب أو نشر إعلان أو إرسال رسالة أو طلب توثيق، فإنك توافق على هذه الشروط وسياسة الخصوصية وسياسة المحتوى المحظور وإرشادات الأمان وأي قواعد خاصة تظهر بوضوح عند استخدام ميزة معينة. إذا لم توافق، فلا تستخدم الخدمات التي تتطلب قبول هذه الشروط.",
    enBody:
      "By using RAWAJ, creating an account, posting a listing, sending a message, or requesting verification, you agree to these Terms, the Privacy Policy, prohibited-content rules, safety guidance, and any clearly presented feature-specific terms. If you do not agree, do not use services that require acceptance of these terms.",
  },
  {
    arTitle: "2. طبيعة رواج",
    enTitle: "2. Nature of RAWAJ",
    arBody:
      "رواج منصة إعلانات مبوبة وتواصل بين المستخدمين. ما لم يُعلن صراحة عن خدمة منفصلة بشروط خاصة، رواج ليس بائعاً أو مشترياً أو وكيلاً لأحد الأطراف أو وسيط دفع أو خدمة ضمان أو إسكرو، ولا يستلم ثمن السلعة أو ينقل ملكيتها نيابة عن المستخدمين.",
    enBody:
      "RAWAJ is a classifieds and user-communication platform. Unless a separate service is expressly introduced under specific terms, RAWAJ is not the buyer, seller, agent of either party, payment intermediary, guarantor, or escrow provider, and does not receive purchase funds or transfer ownership on users' behalf.",
  },
  {
    arTitle: "3. أهلية المستخدم والحساب",
    enTitle: "3. User eligibility and accounts",
    arBody:
      "يجب أن تكون مؤهلاً قانونياً لاستخدام الخدمات التي تتضمن بيعاً أو شراءً أو التزاماً تعاقدياً، وأن تقدم بيانات صحيحة وحديثة. يحظر انتحال شخصية الغير، استخدام حسابات مسروقة، إنشاء حسابات للتحايل على القيود، أو تمكين شخص موقوف من استخدام حسابك.",
    enBody:
      "You must have the legal capacity required for services involving selling, buying, or contractual commitments and must provide accurate, current information. Impersonation, stolen accounts, accounts created to bypass restrictions, and allowing suspended persons to use your account are prohibited.",
  },
  {
    arTitle: "4. أمن الحساب",
    enTitle: "4. Account security",
    arBody:
      "أنت مسؤول عن حماية جهازك وكلمة المرور ورموز التحقق والجلسات المرتبطة بحسابك. لا تطلب إدارة رواج منك كلمة المرور أو رمز التحقق داخل المحادثات. أبلغ الدعم فوراً عند الاشتباه بدخول غير مصرح به، وقد نعلّق بعض الوظائف مؤقتاً لحماية الحساب أثناء التحقيق.",
    enBody:
      "You are responsible for protecting your device, password, verification codes, and account sessions. RAWAJ staff will not ask for your password or verification code in ordinary messages. Contact support immediately if you suspect unauthorized access; some features may be temporarily restricted while the account is protected or investigated.",
  },
  {
    arTitle: "5. مسؤولية المعلن",
    enTitle: "5. Advertiser responsibility",
    arBody:
      "المعلن مسؤول عن صحة العنوان والوصف والصور والسعر والموقع والحالة والمواصفات ووسائل التواصل وأي ادعاء في الإعلان، ويقر بأن لديه الحق في عرض السلعة أو الخدمة وأن المحتوى لا ينتهك ملكية الغير أو حقوقهم أو القوانين المطبقة.",
    enBody:
      "Advertisers are responsible for the accuracy of titles, descriptions, images, prices, locations, condition, specifications, contact details, and all listing claims, and confirm they are entitled to offer the item or service and that the content does not violate third-party rights or applicable law.",
  },
  {
    arTitle: "6. الأنشطة المنظمة والتراخيص",
    enTitle: "6. Regulated activity and licenses",
    arBody:
      "إذا كانت السلعة أو الخدمة أو النشاط يتطلب ترخيصاً أو سجلاً أو موافقة قانونية، فعلى المعلن الحصول عليها والمحافظة على سريانها قبل العرض. وجود الإعلان على رواج لا يشكل ترخيصاً من رواج ولا إثباتاً على استيفاء المتطلبات النظامية.",
    enBody:
      "Where an item, service, or activity requires a license, registration, or legal approval, the advertiser must obtain and maintain it before advertising. A listing appearing on RAWAJ is not a license from RAWAJ and does not prove regulatory compliance.",
  },
  {
    arTitle: "7. المحتوى والسلوك المحظور",
    enTitle: "7. Prohibited content and conduct",
    arBody:
      "يحظر المحتوى أو السلع أو الخدمات غير القانونية أو الاحتيالية أو المسروقة أو المقلدة بصورة تنتهك الحقوق، والأسلحة والذخائر والمتفجرات والمواد المخدرة والمواد الخطرة أو المقيدة، والاستغلال والاتجار بالبشر، والمحتوى الجنسي الصريح، وخطاب الكراهية أو التحريض على العنف، والوثائق المزورة، والبرمجيات الخبيثة والتصيد والسبام والاحتيال المالي والتلاعب بالتقييمات والبلاغات. قائمة المحظورات المنشورة جزء من هذه الشروط وليست حصراً نهائياً لكل مخالفة محتملة.",
    enBody:
      "Illegal, fraudulent, stolen, or rights-infringing counterfeit goods or services are prohibited, as are weapons, ammunition, explosives, drugs, dangerous or restricted materials, exploitation or human trafficking, explicit sexual content, hate or incitement to violence, forged documents, malware, phishing, spam, financial scams, and manipulation of reviews or reports. The published prohibited-content list forms part of these Terms and is not an exhaustive list of every possible violation.",
  },
  {
    arTitle: "8. التفاوض والدفع والتسليم",
    enTitle: "8. Negotiation, payment, and delivery",
    arBody:
      "التفاوض والاتفاق والدفع والاستلام والتسليم وفحص السلعة وأي التزام بين المستخدمين يتم على مسؤولية أطرافه. لا يوجد حالياً نظام دفع أو إسكرو داخل رواج، وأي تحويل خارج المنصة يتم مباشرة بين الأطراف. لا تشارك بيانات البطاقة أو رمز التحقق أو كلمة المرور مع أي مستخدم.",
    enBody:
      "Negotiation, agreement, payment, inspection, collection, delivery, and obligations between users are the responsibility of those parties. RAWAJ currently provides no in-platform payment or escrow. Transfers outside the platform occur directly between users. Never share card details, verification codes, or passwords with another user.",
  },
  {
    arTitle: "9. التوثيق وشارة الحساب",
    enTitle: "9. Verification and account badges",
    arBody:
      "التوثيق ليس حقاً تلقائياً. يخضع لشروط أهلية وفحص وثيقة خاصة ومراجعة يدوية، وقد يرفض الطلب أو يطلب دليل إضافي. شارة التوثيق تعني فقط أن رواج راجع الأدلة المقدمة في وقت المراجعة وفق الإجراء المتاح؛ ولا تعني ضمان الهوية مستقبلاً أو ملكية السلع أو صحة كل إعلان أو جودة المنتج أو قدرة المستخدم المالية أو سلامة الصفقة. يمكن تعليق الشارة أو سحبها عند فقد الأهلية أو اكتشاف معلومات غير صحيحة أو إساءة استخدام.",
    enBody:
      "Verification is not automatic. It is subject to eligibility rules, private-document review, and manual moderation, and additional evidence may be required. A verification badge only means RAWAJ reviewed the evidence supplied at the time under the available process; it does not guarantee future identity, ownership of goods, accuracy of every listing, product quality, financial capacity, or transaction safety. A badge may be suspended or revoked if eligibility is lost, information is found inaccurate, or the feature is abused.",
  },
  {
    arTitle: "10. التقييمات والمراجعات",
    enTitle: "10. Ratings and reviews",
    arBody:
      "يجب أن تعكس التقييمات تجربة حقيقية وذات صلة. يحظر شراء التقييمات أو بيعها أو إنشاء تقييمات وهمية أو متبادلة أو استخدام حسابات متعددة للتأثير على النتيجة. يجوز لرواج إخفاء أو رفض أو إزالة تقييم يخالف القواعد أو لا يمكن ربطه بتجربة مشروعة.",
    enBody:
      "Ratings and reviews must reflect a genuine, relevant experience. Buying, selling, fabricating, exchanging, or manipulating reviews through multiple accounts is prohibited. RAWAJ may hide, reject, or remove reviews that violate the rules or cannot be tied to a legitimate experience.",
  },
  {
    arTitle: "11. المراجعة والإشراف والبلاغات",
    enTitle: "11. Moderation and reports",
    arBody:
      "يجوز لرواج استخدام مراجعة آلية أو بشرية للمحتوى والبلاغات، وطلب معلومات إضافية، ورفض أو إخفاء أو إزالة محتوى، أو تقييد خصائص الحساب عند الاشتباه بمخالفة أو احتيال أو خطر أمني. المراجعة لا تعني أن رواج تحقق من كل معلومة أو يضمن الإعلان أو المستخدم.",
    enBody:
      "RAWAJ may use automated or manual moderation for content and reports, request additional information, reject, hide, or remove content, or restrict account features where a violation, fraud, or security risk is suspected. Moderation does not mean RAWAJ has verified every statement or guarantees a listing or user.",
  },
  {
    arTitle: "12. حقوق الملكية الفكرية",
    enTitle: "12. Intellectual property",
    arBody:
      "لا يجوز نشر صور أو علامات أو نصوص أو مواد لا تملك حق استخدامها. يحتفظ أصحاب الحقوق بحقوقهم، ويجوز إزالة المحتوى عند وجود ادعاء جدي بانتهاك الحقوق أو عند طلب جهة مختصة وفق الإجراءات المطبقة.",
    enBody:
      "You may not publish images, marks, text, or other material you are not authorized to use. Rights holders retain their rights, and content may be removed following a credible infringement claim or a valid request from a competent authority under applicable procedures.",
  },
  {
    arTitle: "13. الخصوصية والبيانات",
    enTitle: "13. Privacy and data",
    arBody:
      "استخدام البيانات الشخصية يخضع لسياسة الخصوصية. أنت مسؤول عن عدم نشر بيانات شخصية تخص الغير دون حق. وثائق التوثيق تحفظ كبيانات خاصة ولا ينبغي إرسالها عبر الإعلان العام أو المحادثة العادية.",
    enBody:
      "Personal-data handling is governed by the Privacy Policy. You are responsible for not publishing another person's personal data without authority. Verification documents are private and should not be sent through public listings or ordinary messages.",
  },
  {
    arTitle: "14. التعليق والإيقاف وسحب المزايا",
    enTitle: "14. Restriction, suspension, and feature removal",
    arBody:
      "يجوز تقييد الحساب أو تعليق بعض وظائفه أو إيقافه، وسحب التوثيق أو المزايا الترويجية، عند المخالفات الجسيمة أو المتكررة أو الاحتيال أو إساءة الاستخدام أو خطر أمني أو محاولة تجاوز أنظمة المنصة. وقد نحتفظ بالسجلات اللازمة للبلاغات أو الأمان أو الالتزامات القانونية بعد التعليق.",
    enBody:
      "RAWAJ may restrict or suspend an account or features and may revoke verification or promotional benefits for serious or repeated violations, fraud, abuse, security risk, or attempts to bypass platform controls. Records required for reports, safety, or legal obligations may be retained after suspension.",
  },
  {
    arTitle: "15. حدود دور ومسؤولية المنصة",
    enTitle: "15. Platform role and liability limits",
    arBody:
      "إلى الحد الذي تسمح به القوانين المطبقة، لا يكون رواج مسؤولاً عن جودة أو أصالة أو ملكية سلعة يعرضها مستخدم، أو عن التزام المستخدمين باتفاقاتهم، أو تحويلات خارج المنصة، أو خسارة ناتجة عن احتيال طرف آخر. لا تستبعد هذه الشروط أي مسؤولية أو حق لا يجوز قانوناً استبعاده أو التنازل عنه.",
    enBody:
      "To the extent permitted by applicable law, RAWAJ is not responsible for the quality, authenticity, or ownership of items offered by users, users' performance of their agreements, off-platform transfers, or losses caused by another user's fraud. These Terms do not exclude any liability or right that cannot lawfully be excluded or waived.",
  },
  {
    arTitle: "16. التعويض عن المخالفات",
    enTitle: "16. Responsibility for violations",
    arBody:
      "يتحمل المستخدم المسؤولية عن المحتوى أو السلوك أو المطالبات الناتجة عن مخالفته لهذه الشروط أو حقوق الغير، وذلك في الحدود التي يسمح بها القانون. لا ينقل استخدام المنصة مسؤولية المعلن أو أطراف الصفقة إلى رواج.",
    enBody:
      "Users remain responsible, to the extent permitted by law, for content, conduct, or claims arising from their violation of these Terms or third-party rights. Using the platform does not transfer the advertiser's or transaction parties' responsibilities to RAWAJ.",
  },
  {
    arTitle: "17. تغيير الخدمة والشروط",
    enTitle: "17. Changes to the service and terms",
    arBody:
      "قد تتغير خصائص المنصة أو هذه الشروط لأسباب تشغيلية أو أمنية أو قانونية. تُنشر النسخة المحدثة وتاريخها، وقد نطلب قبولاً جديداً إذا كان التغيير جوهرياً ويستلزم ذلك. استمرار الاستخدام بعد سريان التحديث يعني القبول في الحدود التي يسمح بها القانون.",
    enBody:
      "Platform features or these Terms may change for operational, security, or legal reasons. The updated version and date will be published, and renewed acceptance may be requested where a material change requires it. Continued use after an update takes effect constitutes acceptance to the extent permitted by law.",
  },
  {
    arTitle: "18. القانون والحقوق الإلزامية",
    enTitle: "18. Applicable law and mandatory rights",
    arBody:
      "تفسر هذه الشروط وتطبق وفق القوانين والأنظمة النافذة ذات الصلة في السوق الذي تقدم فيه الخدمة، مع عدم المساس بحقوق المستهلك أو صاحب البيانات أو أي حقوق إلزامية لا يجوز الاتفاق على إسقاطها. عند وجود تعارض، تسود القواعد الإلزامية المطبقة.",
    enBody:
      "These Terms are interpreted and applied under the relevant laws and regulations in the market where the service is provided, without prejudice to mandatory consumer, data-subject, or other rights that cannot lawfully be waived. Mandatory applicable rules prevail in the event of conflict.",
  },
];

function TermsPage() {
  const { text } = useUiPreferences();
  return (
    <>
      <PageHeader title={text("شروط وسياسة الاستخدام", "Terms of Use")} />
      <main className="container-wide mobile-page-bottom space-y-4 pb-8 pt-4">
        <section className="rounded-2xl bg-card p-5 hairline">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Scale className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-extrabold">
                {text("قواعد واضحة قبل البيع أو الشراء", "Clear rules before buying or selling")}
              </h1>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {text(
                  "آخر تحديث: 15 أغسطس 2026. هذه الشروط جزء من اتفاق استخدام المنصة وتُقرأ مع سياسة الخصوصية والمحتوى المحظور وإرشادات الأمان.",
                  "Last updated: 15 August 2026. These Terms form part of the platform-use agreement and should be read with the Privacy Policy, prohibited-content rules, and safety guidance.",
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
                "تنبيه أساسي: رواج لا يضمن المستخدم أو الإعلان أو السلعة ولا يدير الدفع أو الإسكرو حالياً. افحص وتحقق قبل الدفع، ولا تشارك رموز التحقق أو بيانات البطاقة أو كلمة المرور.",
                "Key warning: RAWAJ does not guarantee a user, listing, or item and currently does not operate payment or escrow. Inspect and verify before paying, and never share verification codes, card details, or passwords.",
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
            {text("سياسات مرتبطة", "Related policies")}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Link
              to="/privacy"
              className="rounded-xl bg-muted-surface px-3 py-2 font-bold hairline"
            >
              {text("سياسة الخصوصية", "Privacy Policy")}
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
              {text("الدعم والبلاغات", "Support and reports")}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
