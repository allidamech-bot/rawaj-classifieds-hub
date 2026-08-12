import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { createSeo } from "@/lib/seo";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";

export const Route = createFileRoute("/terms")({
  head: () =>
    createSeo({
      title: "شروط الاستخدام – سوريا | RAWAJ / رواج",
      description:
        "شروط استخدام رواج سوريا للإعلانات المبوبة، بما يشمل الحسابات والإعلانات والتعاملات والمحظورات والبلاغات وحدود مسؤولية المنصة.",
      path: "/terms",
    }),
  component: TermsPage,
});

type LegalSection = {
  arTitle: string;
  enTitle: string;
  arBody: string;
  enBody: string;
};

const sections: LegalSection[] = [
  {
    arTitle: "قبول الشروط ونطاقها",
    enTitle: "Acceptance and scope",
    arBody:
      "تنطبق هذه الشروط على استخدام موقع وتطبيق وخدمات رَوَاج المخصصة للسوق السوري. عند إنشاء حساب، يطلب رَوَاج موافقة صريحة على هذه الشروط وسياسة الخصوصية. استمرار استخدام المنصة بعد سريان نسخة محدثة يعني قبول النسخة المحدثة، مع مراعاة أي حقوق إلزامية لا يجوز التنازل عنها قانوناً.",
    enBody:
      "These terms apply to the RAWAJ website, app, and services for the Syrian market. Account creation requires explicit acceptance of these Terms and the Privacy Policy. Continued use after an updated version takes effect constitutes acceptance of that version, subject to any mandatory rights that cannot legally be waived.",
  },
  {
    arTitle: "طبيعة رَوَاج ودوره",
    enTitle: "Nature and role of RAWAJ",
    arBody:
      "رَوَاج منصة إعلانات مبوبة ووسيط تقني يتيح للمستخدمين عرض السلع والخدمات والعقارات والمركبات والتواصل بشأنها. رَوَاج ليس بائعاً أو مشترياً في الصفقات المنشورة من المستخدمين، ولا يصبح طرفاً في عقد البيع أو الإيجار أو تقديم الخدمة لمجرد نشر الإعلان أو إتاحة التواصل.",
    enBody:
      "RAWAJ is a classifieds platform and technical intermediary that lets users advertise goods, services, property, and vehicles and communicate about them. RAWAJ is not the buyer or seller in user-posted transactions and does not become a party to a sale, lease, or service contract merely by hosting a listing or enabling communication.",
  },
  {
    arTitle: "الأهلية والحساب",
    enTitle: "Eligibility and account",
    arBody:
      "يجب أن يملك المستخدم الأهلية القانونية اللازمة لاستخدام خدمات الإعلانات وإبرام التعامل الذي يعلنه أو يتفاوض بشأنه. يجب تقديم بيانات حساب صحيحة وعدم انتحال صفة شخص أو جهة أخرى أو إنشاء حسابات بقصد التضليل أو تجاوز القيود أو الإشراف.",
    enBody:
      "Users must have the legal capacity required to use classified-ad services and to enter into the transaction they advertise or negotiate. Account information must be accurate, and users may not impersonate another person or entity or create accounts to mislead others or bypass restrictions or moderation.",
  },
  {
    arTitle: "أمن الحساب",
    enTitle: "Account security",
    arBody:
      "المستخدم مسؤول عن حماية كلمة المرور وجهازه ورموز التحقق وعن النشاط الذي يتم من حسابه ما لم يثبت اختراق خارج عن سيطرته. يجب إبلاغ رَوَاج فور الاشتباه بوصول غير مصرح به، ولا يجوز مشاركة كلمات المرور أو رموز الدخول مع المشترين أو البائعين أو أي طرف يدّعي أنه من فريق رَوَاج.",
    enBody:
      "Users are responsible for protecting passwords, devices, verification codes, and account activity unless unauthorized access beyond their control is established. Suspected unauthorized access should be reported promptly, and passwords or login codes must never be shared with buyers, sellers, or anyone claiming to represent RAWAJ.",
  },
  {
    arTitle: "مسؤولية الإعلان وصحة المعلومات",
    enTitle: "Listing responsibility and accuracy",
    arBody:
      "يتحمل ناشر الإعلان مسؤولية أن يكون العنوان والوصف والصور والسعر والموقع والحالة والمواصفات وأي معلومات أخرى صحيحة وغير مضللة ومحدثة، وأن يملك السلعة أو الصلاحية القانونية لعرضها أو تمثيل صاحبها. لا يجوز استخدام صور أو أوصاف توحي بسلعة مختلفة أو إخفاء عيب جوهري بقصد التضليل.",
    enBody:
      "The listing publisher is responsible for ensuring that titles, descriptions, images, prices, locations, condition, specifications, and other information are accurate, current, and not misleading, and that they own the item or are legally authorized to advertise it. Images or descriptions may not misrepresent the item or intentionally conceal a material defect.",
  },
  {
    arTitle: "الأسعار والمتاجر ومقدمو الخدمات",
    enTitle: "Prices, stores, and service providers",
    arBody:
      "يجب عرض السعر والمعلومات التجارية بصورة واضحة قدر الإمكان. إذا كان المستخدم تاجراً أو متجراً أو مقدم خدمة، فهو المسؤول عن التراخيص والفواتير والضرائب والضمانات والإفصاحات وأي التزامات مهنية أو تجارية أو استهلاكية تنطبق على نشاطه. وجود حساب أو متجر داخل رَوَاج لا يعني اعتماد رَوَاج له أو ضمانه.",
    enBody:
      "Prices and commercial information should be displayed as clearly as reasonably possible. Business users, stores, and service providers remain responsible for licenses, invoices, taxes, warranties, disclosures, and any professional, commercial, or consumer obligations applicable to their activity. A RAWAJ account or storefront is not an endorsement or guarantee by RAWAJ.",
  },
  {
    arTitle: "المحتوى والإعلانات المحظورة",
    enTitle: "Prohibited content and listings",
    arBody:
      "يُحظر نشر أو طلب أو الترويج لمحتوى أو سلع أو خدمات مخالفة للقانون أو للسلامة العامة، بما في ذلك الأسلحة والذخائر والمواد المخدرة والمسروقات والمستندات أو الحسابات غير المشروعة والسلع المقلدة والاحتيال والاستغلال والمحتوى الإباحي أو المسيء بصورة جسيمة وأي مادة يحظر تداولها قانوناً. يجوز لرَوَاج تطبيق قيود أشد على فئات عالية الخطورة حتى لو لم تذكر بالاسم هنا.",
    enBody:
      "Users may not publish, request, or promote unlawful or unsafe content, goods, or services, including weapons or ammunition, narcotics, stolen goods, illicit documents or accounts, counterfeit goods, fraud, exploitation, pornographic or seriously abusive content, or anything whose trade is prohibited by law. RAWAJ may impose stricter rules on high-risk categories even when they are not individually named here.",
  },
  {
    arTitle: "السلوك الممنوع",
    enTitle: "Prohibited conduct",
    arBody:
      "يُمنع الاحتيال والتصيد وانتحال الهوية وإرسال الرسائل المزعجة وجمع بيانات المستخدمين دون مسوغ ومحاولات اختراق المنصة أو تعطيلها أو تجاوز أنظمة الأمان أو الإشراف أو التلاعب بالمشاهدات والتقييمات والبلاغات أو استخدام أدوات آلية بصورة تضر بالخدمة أو المستخدمين.",
    enBody:
      "Fraud, phishing, impersonation, spam, unjustified harvesting of user data, attempts to compromise or disrupt the platform, bypassing security or moderation, manipulating views, ratings, or reports, and harmful automated use are prohibited.",
  },
  {
    arTitle: "التواصل والاحتيال والصفقات",
    enTitle: "Communication, fraud, and transactions",
    arBody:
      "تتم المفاوضة والدفع والتسليم والمعاينة ونقل الملكية وأي التزام تعاقدي بين المستخدمين وعلى مسؤوليتهم. يجب التحقق من هوية الطرف الآخر وحالة السلعة والمستندات والسعر قبل الدفع، وتجنب التحويلات أو الروابط أو الطلبات المشبوهة. رَوَاج لا يضمن هوية أي مستخدم أو قدرته المالية أو ملكيته للسلعة أو إتمام الصفقة.",
    enBody:
      "Negotiation, payment, delivery, inspection, transfer of ownership, and contractual obligations take place between users at their own responsibility. Users should verify the counterparty, item condition, documents, and price before payment and avoid suspicious transfers, links, or requests. RAWAJ does not guarantee a user's identity, financial capacity, ownership of an item, or completion of a transaction.",
  },
  {
    arTitle: "المدفوعات خارج رَوَاج",
    enTitle: "Payments outside RAWAJ",
    arBody:
      "ما لم تعلن المنصة صراحة عن خدمة دفع داخلية محددة، لا يعالج رَوَاج ثمن الصفقات المنشورة ولا يحتفظ بأموال المستخدمين كوسيط مالي. أي تحويل أو عربون أو دفع يتم مباشرة بين الأطراف أو عبر خدمة خارجية يخضع لشروط تلك الجهة ولمخاطر التعامل التي يجب على المستخدم تقييمها.",
    enBody:
      "Unless RAWAJ expressly introduces a specific in-platform payment service, RAWAJ does not process the purchase price of user listings or hold user funds as a financial intermediary. Transfers, deposits, or payments made directly between parties or through an external service are subject to that provider's terms and risks that users must assess.",
  },
  {
    arTitle: "الملكية الفكرية وحقوق الغير",
    enTitle: "Intellectual property and third-party rights",
    arBody:
      "يجب ألا ينتهك الإعلان حقوق الملكية الفكرية أو الخصوصية أو الصورة أو أي حق للغير. يحتفظ المستخدم بملكيته للمحتوى الذي يرفعه، ويمنح رَوَاج ترخيصاً غير حصري ومحدوداً بالقدر اللازم لاستضافة المحتوى ومعالجته وعرضه وتنسيقه ومراجعته وتشغيل ميزات المنصة والترويج للإعلان داخل خدمات رَوَاج ما دام المحتوى منشوراً أو مطلوباً للاحتفاظ النظامي أو الأمني.",
    enBody:
      "Listings must not infringe intellectual property, privacy, image rights, or other third-party rights. Users retain ownership of uploaded content and grant RAWAJ a non-exclusive license limited to what is necessary to host, process, display, format, moderate, operate platform features, and promote the listing within RAWAJ while the content is published or must be retained for legal or security reasons.",
  },
  {
    arTitle: "الإشراف والبلاغات",
    enTitle: "Moderation and reports",
    arBody:
      "يجوز لرَوَاج استخدام مراجعة بشرية أو آلية لاكتشاف المخالفات، وطلب معلومات إضافية، أو رفض إعلان أو إخفائه أو حذفه، أو تقييد ميزات الحساب، أو حفظ أدلة لازمة للتحقيق في إساءة الاستخدام. يمكن للمستخدمين الإبلاغ عن الإعلانات أو الحسابات المخالفة، وتُراجع البلاغات وفق المعلومات المتاحة وخطورة الحالة.",
    enBody:
      "RAWAJ may use human or automated moderation to detect violations, request additional information, reject, hide, or remove listings, restrict account features, or preserve evidence needed to investigate abuse. Users may report violating listings or accounts, and reports are reviewed according to available information and severity.",
  },
  {
    arTitle: "تعليق الحساب أو إنهاؤه",
    enTitle: "Suspension or termination",
    arBody:
      "يجوز تقييد الحساب أو تعليقه أو إنهاؤه عند وجود مخالفة جسيمة أو متكررة، أو خطر على المستخدمين أو المنصة، أو محاولة تجاوز قرار سابق، أو عند وجود متطلب قانوني أو أمني. لا يمنع إغلاق الحساب الاحتفاظ بسجلات محدودة عندما تكون لازمة للأمان أو مكافحة الاحتيال أو تنفيذ التزامات قانونية.",
    enBody:
      "Accounts may be restricted, suspended, or terminated for serious or repeated violations, risks to users or the platform, attempts to evade a prior action, or legal or security requirements. Account closure does not prevent limited retention of records needed for safety, fraud prevention, or legal obligations.",
  },
  {
    arTitle: "الخصوصية والبيانات",
    enTitle: "Privacy and data",
    arBody:
      "توضح سياسة الخصوصية أنواع البيانات التي يعالجها رَوَاج وأغراض استخدامها وخيارات المستخدم. يجب على المستخدم عدم نشر بيانات شخصية حساسة لا يحتاجها الإعلان، وهو مسؤول عن بيانات الآخرين التي يرفعها أو يشاركها وعن امتلاكه أساساً مشروعاً لذلك.",
    enBody:
      "The Privacy Policy explains the data RAWAJ processes, why it is used, and available user choices. Users should not publish sensitive personal data unnecessary for a listing and are responsible for third-party data they upload or share and for having a lawful basis to do so.",
  },
  {
    arTitle: "توفر الخدمة والتغييرات التقنية",
    enTitle: "Service availability and technical changes",
    arBody:
      "نسعى إلى إبقاء رَوَاج متاحاً وآمناً، لكن قد تحدث صيانة أو أعطال أو انقطاعات أو تغييرات في الخصائص أو حدود الاستخدام. لا يضمن رَوَاج بقاء إعلان في ترتيب معين أو تحقيق عدد محدد من المشاهدات أو الرسائل أو المبيعات.",
    enBody:
      "We aim to keep RAWAJ available and secure, but maintenance, outages, interruptions, feature changes, or usage limits may occur. RAWAJ does not guarantee a listing's ranking or any specific number of views, messages, or sales.",
  },
  {
    arTitle: "الخدمات والروابط الخارجية",
    enTitle: "External services and links",
    arBody:
      "قد تتكامل المنصة مع خدمات خارجية مثل تسجيل الدخول أو الخرائط أو التحليلات أو الإشعارات. تخضع تلك الخدمات أيضاً لشروطها وسياساتها، ولا يتحمل رَوَاج مسؤولية محتوى أو ممارسات جهة خارجية لا يسيطر عليها، مع بقاء مسؤوليات رَوَاج التي يفرضها القانون عن اختياراته وتشغيله للخدمة.",
    enBody:
      "The platform may integrate third-party services such as authentication, maps, analytics, or notifications. Those services are also governed by their own terms and policies. RAWAJ is not responsible for third-party content or practices outside its control, while retaining any responsibilities the law imposes on RAWAJ for its own choices and operation of the service.",
  },
  {
    arTitle: "حدود مسؤولية رَوَاج",
    enTitle: "Limits of RAWAJ liability",
    arBody:
      "رَوَاج لا يضمن جودة أو سلامة أو قانونية أو ملكية السلع والخدمات المنشورة من المستخدمين، ولا موثوقية أطراف التعامل، ولا يتحمل الخسائر الناتجة عن احتيال أو دفع أو تسليم أو اتفاق يتم مباشرة بين المستخدمين، إلا في الحدود التي يفرض فيها القانون مسؤولية لا يجوز استبعادها. لا تتضمن هذه الشروط إعفاء رَوَاج من مسؤوليته عن فعله المتعمد أو أي مسؤولية لا يسمح القانون باستبعادها.",
    enBody:
      "RAWAJ does not guarantee the quality, safety, legality, or ownership of user-listed goods or services or the reliability of transaction parties, and is not responsible for losses arising from fraud, payment, delivery, or agreements made directly between users except where applicable law imposes liability that cannot be excluded. These terms do not exclude RAWAJ's liability for intentional misconduct or any liability that law does not permit to be excluded.",
  },
  {
    arTitle: "تعديل الشروط",
    enTitle: "Changes to these terms",
    arBody:
      "قد نحدّث الشروط عند تغير خصائص المنصة أو المخاطر أو المتطلبات التنظيمية. ننشر تاريخ آخر تحديث، وقد نطلب موافقة جديدة عند وجود تعديل جوهري يتعلق بحقوق المستخدم أو التزاماته. لا تطبق التعديلات بأثر رجعي بما يخالف القانون.",
    enBody:
      "We may update these terms when platform features, risks, or regulatory requirements change. We publish the latest update date and may request renewed consent for material changes affecting user rights or obligations. Updates are not applied retroactively where prohibited by law.",
  },
  {
    arTitle: "القانون المختص وتسوية النزاعات",
    enTitle: "Governing law and disputes",
    arBody:
      "تخضع هذه الشروط للقوانين السورية النافذة بالقدر الذي تنطبق فيه على الخدمة والمستخدم والتعامل محل النزاع. نشجع أولاً على محاولة حل الشكاوى المتعلقة بالمنصة عبر الدعم، دون أن يمنع ذلك أي طرف من اللجوء إلى الجهة القضائية أو الإدارية المختصة وفق القانون.",
    enBody:
      "These terms are governed by applicable Syrian law to the extent it applies to the service, user, and disputed transaction. We encourage platform-related complaints to be raised with support first, without preventing any party from using the competent judicial or administrative authority as provided by law.",
  },
  {
    arTitle: "التواصل والدعم",
    enTitle: "Contact and support",
    arBody:
      "يمكن التواصل مع فريق رَوَاج بخصوص الشروط أو البلاغات أو الحسابات عبر صفحة الدعم داخل المنصة. عند تقديم طلب يتعلق بحساب أو بيانات شخصية قد نطلب التحقق من هوية صاحب الحساب قبل تنفيذ إجراء حساس.",
    enBody:
      "Users can contact RAWAJ about these terms, reports, or accounts through the platform's support page. For requests involving an account or personal data, identity verification may be required before a sensitive action is completed.",
  },
];

function TermsPage() {
  const { language, text } = useUiPreferences();

  return (
    <>
      <PageHeader title={text("شروط الاستخدام – سوريا", "Terms of Use – Syria")} />
      <main className="rawaj-legal-v3 container-wide mobile-page-bottom pt-4">
        <div className="mb-4 rounded-2xl border border-border/80 bg-card p-4">
          <p className="text-xs font-bold text-foreground">
            {text("نسخة رَوَاج سوريا", "RAWAJ Syria version")}
          </p>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            {text(
              "آخر تحديث: 13 آب 2026. اقرأ هذه الشروط قبل إنشاء الحساب أو نشر إعلان أو التواصل لإتمام صفقة.",
              "Last updated: August 13, 2026. Read these terms before creating an account, posting a listing, or communicating to complete a transaction.",
            )}
          </p>
        </div>
        <div className="space-y-3">
          {sections.map((section, index) => (
            <section key={section.arTitle} className="rounded-2xl bg-card p-4 hairline">
              <h2 className="mb-2 text-base font-extrabold text-foreground">
                {index + 1}. {legalText(section, language, "title")}
              </h2>
              <p className="text-sm leading-7 text-foreground/90">
                {legalText(section, language, "body")}
              </p>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}

function legalText(section: LegalSection, language: Language, part: "title" | "body") {
  if (language === "ar") return part === "title" ? section.arTitle : section.arBody;
  return part === "title" ? section.enTitle : section.enBody;
}
