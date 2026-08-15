import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BadgeCheck,
  CreditCard,
  Flag,
  Link2Off,
  MapPinned,
  MessageCircleWarning,
  ShoppingCart,
  Store,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SafetyGuideCard, TrustHubHero } from "@/features/trust/TrustSupportExperience";
import { createSeo } from "@/lib/seo";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";

export const Route = createFileRoute("/safety")({
  head: () =>
    createSeo({
      title: "إرشادات الأمان والتعامل الآمن | RAWAJ / رواج",
      description:
        "إرشادات رواج لمكافحة الاحتيال وحماية الحساب والدفع والمعاينة والتواصل والتبليغ عن المخالفات.",
      path: "/safety",
    }),
  component: SafetyPage,
});

const sections: {
  icon: typeof ShoppingCart;
  title: string;
  items: string[];
  warning?: boolean;
}[] = [
  {
    icon: ShoppingCart,
    title: "قبل الشراء",
    items: [
      "قارن السعر بالسوق؛ السعر غير المنطقي قد يكون إشارة خطر.",
      "اطلب صوراً حديثة ومعلومات محددة وتحقق من تطابقها مع الإعلان.",
      "افحص السلعة أو اطلب فحصاً مستقلاً قبل الدفع، خصوصاً المركبات والعقارات والسلع مرتفعة القيمة.",
      "لا تعتمد على صورة هوية أو فاتورة يرسلها الطرف الآخر وحدها كدليل نهائي.",
      "إذا رفض الطرف المعاينة أو استعجل التحويل أو غيّر القصة أكثر من مرة، أوقف التعامل.",
    ],
  },
  {
    icon: Store,
    title: "قبل البيع والتسليم",
    items: [
      "لا تسلم السلعة قبل التأكد من استلام المقابل بالطريقة التي اخترتها فعلاً.",
      "لا تعتمد على صورة تحويل أو رسالة نصية كإثبات وحيد لوصول المال.",
      "تجنب مشاركة عنوان المنزل أو معلومات عائلية عندما لا تكون ضرورية للتعامل.",
      "للسلع مرتفعة القيمة، وثّق حالة السلعة وما تم الاتفاق عليه بصورة واضحة.",
      "استخدم مكاناً عاماً وآمناً للمعاينة والتسليم متى كان ذلك ممكناً.",
    ],
  },
  {
    icon: CreditCard,
    title: "الدفع والتحويل",
    warning: true,
    items: [
      "لا يوجد حالياً دفع أو إسكرو داخل رواج؛ أي تحويل خارج المنصة يتم مباشرة بين المستخدمين.",
      "لا ترسل رمز OTP أو رمز تحقق أو كلمة مرور أو بيانات البطاقة لأي شخص، حتى لو ادعى أنه من رواج.",
      "لا تضغط روابط دفع أو شحن يرسلها مستخدم إذا لم تتحقق من الجهة والعنوان بنفسك.",
      "احذر طلب رسوم مقدمة لفك حجز أو استلام جائزة أو تفعيل حوالة أو إثبات جدية.",
      "إذا ادعى شخص أن رواج يحتجز المال أو يضمن التحويل، اعتبر ذلك مؤشراً قوياً للاحتيال حالياً.",
    ],
  },
  {
    icon: Link2Off,
    title: "الروابط والتصيد",
    warning: true,
    items: [
      "افتح رواج من عنوانه المعروف أو التطبيق، ولا تسجل الدخول من رابط يرسله مستخدم.",
      "افحص اسم النطاق حرفاً بحرف قبل إدخال أي بيانات.",
      "رواج لا يطلب كلمة المرور أو رمز التحقق داخل المحادثات.",
      "لا تثبت تطبيقات أو ملفات يرسلها شخص بحجة الدفع أو الشحن أو التحقق.",
    ],
  },
  {
    icon: BadgeCheck,
    title: "فهم التوثيق الصحيح",
    items: [
      "شارة التوثيق تعني أن رواج راجع أدلة الحساب وفق مسار التوثيق المتاح وقت المراجعة.",
      "التوثيق لا يضمن ملكية السلعة ولا صحة كل إعلان ولا قدرة المستخدم المالية ولا سلامة الصفقة.",
      "استمر في فحص السلعة والتحقق من المستندات اللازمة حتى عند التعامل مع حساب موثّق.",
      "يمكن تعليق أو سحب التوثيق عند ظهور معلومات غير صحيحة أو فقد شروط الأهلية.",
    ],
  },
  {
    icon: MapPinned,
    title: "المعاينة واللقاء",
    items: [
      "اختر مكاناً عاماً ومناسباً وتجنب الأماكن المعزولة أو المواعيد غير الآمنة.",
      "أخبر شخصاً تثق به بمكان اللقاء عند التعامل بمبلغ مرتفع.",
      "لا تحمل مبالغ نقدية كبيرة دون حاجة، واستخدم إجراءات تحقق مناسبة لطبيعة الصفقة.",
      "في المركبات والعقارات والمستندات الرسمية، استخدم الجهات أو القنوات الرسمية للتحقق عند توفرها.",
    ],
  },
  {
    icon: MessageCircleWarning,
    title: "مؤشرات الاحتيال الشائعة",
    warning: true,
    items: [
      "استعجال شديد مع طلب تحويل فوري أو عربون قبل أي تحقق.",
      "طلب الانتقال فوراً إلى قناة خارجية ثم إرسال رابط دفع أو شحن غير معروف.",
      "ادعاء وجود وسيط أو موظف رواج يضمن الصفقة أو يحتجز الأموال.",
      "طلب بيانات هوية أو بطاقة أو رمز تحقق لا علاقة له بإتمام الصفقة بصورة مشروعة.",
      "رفض المعاينة مع تقديم أعذار متكررة أو اختلاف واضح بين الصور والوصف.",
    ],
  },
  {
    icon: Flag,
    title: "التبليغ وحفظ الأدلة",
    items: [
      "استخدم زر الإبلاغ عند الاشتباه بإعلان أو مستخدم أو رسالة.",
      "احتفظ بالمحادثة ورقم الإعلان وأي إثبات تحويل أو رابط مشبوه عند تقديم البلاغ.",
      "لا تواجه المحتال أو تحاول استرداد المال بوسائل غير قانونية.",
      "إذا كان هناك تهديد مباشر أو ابتزاز أو جريمة أو خطر على السلامة، تواصل مع الجهات المختصة في بلدك إضافة إلى إبلاغ رواج.",
    ],
  },
];

function SafetyPage() {
  const { language, text } = useUiPreferences();

  return (
    <>
      <PageHeader title={text("إرشادات الأمان", "Safety guidance")} />
      <main className="rawaj-trust-v2 rawaj-safety-v2 container-wide mobile-page-bottom space-y-4 pb-8 pt-4">
        <TrustHubHero mode="safety" />

        <section className="rounded-2xl bg-destructive/10 p-4 hairline">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <strong className="text-sm text-destructive">{text("لا يوجد دفع أو إسكرو داخل رواج حالياً", "RAWAJ currently provides no payment or escrow")}</strong>
              <p className="mt-1 text-xs leading-6 text-foreground/80">{text("لا تحوّل المال لأن شخصاً قال إن رواج سيحجزه أو يضمنه. افحص وتحقق بنفسك قبل أي دفع أو تسليم.", "Do not transfer money because someone claims RAWAJ will hold or guarantee it. Inspect and verify independently before any payment or handover.")}</p>
            </div>
          </div>
        </section>

        <div className="rawaj-safety-guide-grid">
          {sections.map((section) => (
            <SafetyGuideCard
              key={section.title}
              icon={section.icon}
              title={safetyText(section.title, language)}
              items={section.items.map((item) => safetyText(item, language))}
              warning={section.warning}
            />
          ))}
        </div>

        <section className="rounded-2xl bg-card p-4 hairline">
          <p className="text-xs leading-6 text-muted-foreground">{text("هذه الإرشادات تقلل المخاطر لكنها لا تضمن سلامة أي صفقة. مسؤولية التحقق والقرار النهائي تقع على أطراف التعامل، مع بقاء حقوقهم القانونية المطبقة محفوظة.", "These tips reduce risk but do not guarantee any transaction. Verification and the final decision remain the responsibility of the parties, without limiting their applicable legal rights.")}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Link to="/prohibited" className="rounded-xl bg-muted-surface px-4 py-2.5 text-center text-xs font-bold hairline">{text("المحتوى المحظور", "Prohibited content")}</Link>
            <Link to="/terms" className="rounded-xl bg-muted-surface px-4 py-2.5 text-center text-xs font-bold hairline">{text("شروط الاستخدام", "Terms of Use")}</Link>
            <Link to="/support" className="rounded-xl bg-primary px-4 py-2.5 text-center text-xs font-bold text-primary-foreground">{text("الإبلاغ أو الدعم", "Report or support")}</Link>
          </div>
        </section>
      </main>
    </>
  );
}

function safetyText(value: string, language: Language) {
  if (language === "ar") return value;
  const labels: Record<string, string> = {
    "قبل الشراء": "Before buying",
    "قارن السعر بالسوق؛ السعر غير المنطقي قد يكون إشارة خطر.": "Compare the price with the market; an unrealistic price can be a warning sign.",
    "اطلب صوراً حديثة ومعلومات محددة وتحقق من تطابقها مع الإعلان.": "Ask for current photos and specific details and make sure they match the listing.",
    "افحص السلعة أو اطلب فحصاً مستقلاً قبل الدفع، خصوصاً المركبات والعقارات والسلع مرتفعة القيمة.": "Inspect the item or obtain an independent inspection before paying, especially for vehicles, property, and high-value goods.",
    "لا تعتمد على صورة هوية أو فاتورة يرسلها الطرف الآخر وحدها كدليل نهائي.": "Do not treat an ID image or invoice sent by the other party as conclusive proof by itself.",
    "إذا رفض الطرف المعاينة أو استعجل التحويل أو غيّر القصة أكثر من مرة، أوقف التعامل.": "Stop the transaction if the other party refuses inspection, pressures you to transfer, or repeatedly changes their story.",
    "قبل البيع والتسليم": "Before selling and handover",
    "لا تسلم السلعة قبل التأكد من استلام المقابل بالطريقة التي اخترتها فعلاً.": "Do not hand over the item until you have actually confirmed receipt of payment using your chosen method.",
    "لا تعتمد على صورة تحويل أو رسالة نصية كإثبات وحيد لوصول المال.": "Do not rely on a transfer screenshot or text message as the only proof that funds arrived.",
    "تجنب مشاركة عنوان المنزل أو معلومات عائلية عندما لا تكون ضرورية للتعامل.": "Avoid sharing your home address or family information when it is not necessary for the transaction.",
    "للسلع مرتفعة القيمة، وثّق حالة السلعة وما تم الاتفاق عليه بصورة واضحة.": "For high-value items, clearly document the item's condition and the agreement.",
    "استخدم مكاناً عاماً وآمناً للمعاينة والتسليم متى كان ذلك ممكناً.": "Use a public, safe place for inspection and handover where possible.",
    "الدفع والتحويل": "Payment and transfers",
    "لا يوجد حالياً دفع أو إسكرو داخل رواج؛ أي تحويل خارج المنصة يتم مباشرة بين المستخدمين.": "RAWAJ currently has no in-platform payment or escrow; off-platform transfers occur directly between users.",
    "لا ترسل رمز OTP أو رمز تحقق أو كلمة مرور أو بيانات البطاقة لأي شخص، حتى لو ادعى أنه من رواج.": "Never send OTPs, verification codes, passwords, or card details to anyone, even if they claim to be from RAWAJ.",
    "لا تضغط روابط دفع أو شحن يرسلها مستخدم إذا لم تتحقق من الجهة والعنوان بنفسك.": "Do not open payment or shipping links sent by a user unless you independently verify the provider and address.",
    "احذر طلب رسوم مقدمة لفك حجز أو استلام جائزة أو تفعيل حوالة أو إثبات جدية.": "Beware of advance fees to release a hold, claim a prize, activate a transfer, or prove seriousness.",
    "إذا ادعى شخص أن رواج يحتجز المال أو يضمن التحويل، اعتبر ذلك مؤشراً قوياً للاحتيال حالياً.": "If someone claims RAWAJ is holding money or guaranteeing a transfer, treat that as a strong fraud signal under the current service.",
    "الروابط والتصيد": "Links and phishing",
    "افتح رواج من عنوانه المعروف أو التطبيق، ولا تسجل الدخول من رابط يرسله مستخدم.": "Open RAWAJ from its known address or app and never sign in through a link sent by another user.",
    "افحص اسم النطاق حرفاً بحرف قبل إدخال أي بيانات.": "Check the domain name character by character before entering any data.",
    "رواج لا يطلب كلمة المرور أو رمز التحقق داخل المحادثات.": "RAWAJ does not ask for passwords or verification codes in ordinary messages.",
    "لا تثبت تطبيقات أو ملفات يرسلها شخص بحجة الدفع أو الشحن أو التحقق.": "Do not install apps or files someone sends under the pretext of payment, shipping, or verification.",
    "فهم التوثيق الصحيح": "Understanding verification",
    "شارة التوثيق تعني أن رواج راجع أدلة الحساب وفق مسار التوثيق المتاح وقت المراجعة.": "A verification badge means RAWAJ reviewed account evidence under the verification process available at the time.",
    "التوثيق لا يضمن ملكية السلعة ولا صحة كل إعلان ولا قدرة المستخدم المالية ولا سلامة الصفقة.": "Verification does not guarantee item ownership, every listing's accuracy, financial capacity, or transaction safety.",
    "استمر في فحص السلعة والتحقق من المستندات اللازمة حتى عند التعامل مع حساب موثّق.": "Continue inspecting the item and checking necessary documents even when dealing with a verified account.",
    "يمكن تعليق أو سحب التوثيق عند ظهور معلومات غير صحيحة أو فقد شروط الأهلية.": "Verification may be suspended or revoked if information proves inaccurate or eligibility is lost.",
    "المعاينة واللقاء": "Inspection and meeting",
    "اختر مكاناً عاماً ومناسباً وتجنب الأماكن المعزولة أو المواعيد غير الآمنة.": "Choose a public, appropriate place and avoid isolated locations or unsafe meeting times.",
    "أخبر شخصاً تثق به بمكان اللقاء عند التعامل بمبلغ مرتفع.": "Tell someone you trust where you are meeting when a high-value transaction is involved.",
    "لا تحمل مبالغ نقدية كبيرة دون حاجة، واستخدم إجراءات تحقق مناسبة لطبيعة الصفقة.": "Avoid carrying large amounts of cash unnecessarily and use verification appropriate to the transaction.",
    "في المركبات والعقارات والمستندات الرسمية، استخدم الجهات أو القنوات الرسمية للتحقق عند توفرها.": "For vehicles, property, and official documents, use official verification channels where available.",
    "مؤشرات الاحتيال الشائعة": "Common fraud signals",
    "استعجال شديد مع طلب تحويل فوري أو عربون قبل أي تحقق.": "Extreme urgency combined with a request for immediate transfer or deposit before verification.",
    "طلب الانتقال فوراً إلى قناة خارجية ثم إرسال رابط دفع أو شحن غير معروف.": "Pushing you immediately to an external channel and then sending an unknown payment or shipping link.",
    "ادعاء وجود وسيط أو موظف رواج يضمن الصفقة أو يحتجز الأموال.": "Claiming that a RAWAJ employee or intermediary guarantees the deal or holds funds.",
    "طلب بيانات هوية أو بطاقة أو رمز تحقق لا علاقة له بإتمام الصفقة بصورة مشروعة.": "Requesting ID, card data, or verification codes unrelated to a legitimate transaction need.",
    "رفض المعاينة مع تقديم أعذار متكررة أو اختلاف واضح بين الصور والوصف.": "Refusing inspection with repeated excuses or showing obvious inconsistencies between photos and description.",
    "التبليغ وحفظ الأدلة": "Reporting and preserving evidence",
    "استخدم زر الإبلاغ عند الاشتباه بإعلان أو مستخدم أو رسالة.": "Use the report function when you suspect a listing, user, or message.",
    "احتفظ بالمحادثة ورقم الإعلان وأي إثبات تحويل أو رابط مشبوه عند تقديم البلاغ.": "Keep the conversation, listing ID, payment evidence, and suspicious links when reporting.",
    "لا تواجه المحتال أو تحاول استرداد المال بوسائل غير قانونية.": "Do not confront a suspected scammer or attempt recovery through unlawful means.",
    "إذا كان هناك تهديد مباشر أو ابتزاز أو جريمة أو خطر على السلامة، تواصل مع الجهات المختصة في بلدك إضافة إلى إبلاغ رواج.": "If there is an immediate threat, extortion, crime, or safety risk, contact the competent authorities in your country as well as reporting it to RAWAJ.",
  };
  return labels[value] ?? value;
}
