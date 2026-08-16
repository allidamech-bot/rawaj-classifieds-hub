import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Ban, Flag, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/prohibited")({
  head: () =>
    createSeo({
      title: "المحتوى والإعلانات المحظورة | RAWAJ / رواج",
      description:
        "سياسة رواج للمحتوى والسلع والخدمات والسلوك المحظور وإجراءات الإزالة والتقييد والإبلاغ.",
      path: "/prohibited",
    }),
  component: ProhibitedPage,
});

const items = [
  [
    "الأسلحة والذخائر والمتفجرات وأجزاؤها والمواد المخصصة لصنعها أو تعديلها.",
    "Weapons, ammunition, explosives, their parts, and materials intended to manufacture or modify them.",
  ],
  [
    "المخدرات والمؤثرات العقلية والمواد غير القانونية أو الخاضعة لقيود تمنع تداولها بهذه الطريقة.",
    "Illegal drugs, controlled substances, and materials whose sale through the platform is prohibited or restricted.",
  ],
  [
    "الأدوية أو المنتجات الطبية المقيدة والوصفات والمواد الصحية التي تتطلب مساراً مرخصاً غير متوفر على رواج.",
    "Restricted medicines, prescriptions, and regulated medical products requiring a licensed channel not provided by RAWAJ.",
  ],
  [
    "البضائع المسروقة أو مجهولة المصدر أو التي لا يملك المعلن حق بيعها.",
    "Stolen goods, goods of unknown origin, or items the advertiser has no right to sell.",
  ],
  [
    "السلع المقلدة أو المنتهكة لعلامة تجارية أو حقوق مؤلف أو ملكية فكرية للغير.",
    "Counterfeit goods or content infringing trademarks, copyright, or other intellectual-property rights.",
  ],
  [
    "الوثائق المزورة أو المسروقة أو بيع الهويات والجوازات والشهادات والعملات أو أدوات التزوير.",
    "Forged or stolen documents, identity documents, passports, certificates, currency, or forgery tools.",
  ],
  [
    "الاحتيال المالي، الاستثمارات الوهمية، العمولات المضللة، القروض غير المشروعة، غسل الأموال أو تمويه مصدر الأموال.",
    "Financial scams, fake investments, deceptive commission schemes, unlawful lending, money laundering, or concealment of funds.",
  ],
  [
    "حسابات أو بطاقات أو بيانات مصرفية مسروقة، رموز تحقق، كلمات مرور، بيانات دخول، أو بيانات شخصية حساسة للبيع أو التبادل.",
    "Stolen accounts, cards, banking data, verification codes, passwords, login credentials, or sensitive personal data offered for sale or exchange.",
  ],
  [
    "برمجيات خبيثة أو أدوات تصيد أو سرقة حسابات أو اختراق أو تعطيل أنظمة أو تجاوز وسائل الحماية.",
    "Malware, phishing tools, credential theft, hacking, system disruption, or tools intended to bypass security controls.",
  ],
  [
    "الاتجار بالبشر أو الاستغلال أو الخدمات التي تتضمن إكراهاً أو إساءة أو استغلال قاصر أو شخص ضعيف.",
    "Human trafficking, exploitation, coercive services, or abuse or exploitation of minors or vulnerable persons.",
  ],
  [
    "المحتوى الجنسي الصريح أو الاستغلال الجنسي أو الخدمات الجنسية المخالفة للقوانين أو قواعد المنصة.",
    "Explicit sexual content, sexual exploitation, or sexual services prohibited by law or platform rules.",
  ],
  [
    "خطاب الكراهية أو التحريض على العنف أو التهديد أو تمجيد جماعات أو أعمال محظورة قانوناً.",
    "Hate speech, incitement to violence, threats, or glorification of groups or acts prohibited by law.",
  ],
  [
    "بيع حيوانات أو منتجات أو مواد محمية أو محظورة بما يخالف القوانين البيئية أو متطلبات الرفق بالحيوان.",
    "Sale of protected animals, wildlife products, or materials contrary to environmental or animal-welfare requirements.",
  ],
  [
    "المواد الخطرة أو السامة أو المشعة أو الكيميائية المقيدة أو أي منتج يشكل خطراً غير مقبول على السلامة العامة.",
    "Hazardous, toxic, radioactive, or restricted chemicals, or products presenting an unacceptable public-safety risk.",
  ],
  [
    "الخدمات المنظمة أو المهنية التي تتطلب ترخيصاً عندما لا يملك المعلن الترخيص أو لا تسمح المنصة بهذا النوع من النشاط.",
    "Regulated or professional services requiring a license where the advertiser lacks the required authorization or the platform does not permit the activity.",
  ],
  [
    "بيع أو تأجير أصول أو عقارات أو مركبات أو حقوق لا يملك المعلن سلطة قانونية للتصرف بها.",
    "Offering assets, property, vehicles, or rights the advertiser lacks legal authority to sell or lease.",
  ],
  [
    "الإعلانات المضللة: معلومات جوهرية كاذبة، صور لا تخص السلعة، سعر وهمي لجذب التواصل، أو إخفاء عيب جوهري بصورة متعمدة.",
    "Misleading listings: materially false information, unrelated images, bait pricing, or deliberate concealment of a material defect.",
  ],
  [
    "السبام، الإعلانات المكررة بقصد الإغراق، الروابط الخبيثة، جمع بيانات المستخدمين دون حق، أو استخدام رواج للتسويق غير المرغوب.",
    "Spam, flooding with duplicate listings, malicious links, unauthorized harvesting of user data, or unsolicited marketing through RAWAJ.",
  ],
  [
    "التلاعب بالتقييمات والبلاغات والتوثيق، بما في ذلك شراء التقييمات أو تزوير مستندات التوثيق أو تقديم بلاغات كيدية منظمة.",
    "Manipulation of ratings, reports, or verification, including purchased reviews, forged verification evidence, or coordinated malicious reporting.",
  ],
  [
    "أي سلعة أو خدمة أو محتوى يخالف القوانين المطبقة أو أوامر الجهات المختصة أو يشكل خطراً واضحاً على المستخدمين أو المنصة.",
    "Any item, service, or content that violates applicable law or competent-authority requirements or creates a clear risk to users or the platform.",
  ],
] as const;

function ProhibitedPage() {
  const { text } = useUiPreferences();

  return (
    <>
      <PageHeader title={text("المحتوى المحظور", "Prohibited content")} />
      <main className="rawaj-prohibited-v3 container-wide mobile-page-bottom space-y-4 pb-8 pt-4">
        <section className="rounded-2xl bg-destructive/10 p-4 hairline">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-destructive" />
            <div>
              <h1 className="text-base font-extrabold text-destructive">
                {text(
                  "سياسة منع واضحة وليست قائمة شكلية",
                  "A real enforcement policy, not a cosmetic list",
                )}
              </h1>
              <p className="mt-1 text-xs leading-6 text-foreground/80">
                {text(
                  "يمكن رفض أو إزالة الإعلان، تقييد الحساب، سحب التوثيق أو المزايا، وحفظ السجلات اللازمة للمراجعة عند الاشتباه بمخالفة. في الحالات الخطرة أو عندما يوجب القانون ذلك، قد تُتخذ إجراءات إضافية وفق الصلاحيات والالتزامات المطبقة.",
                  "A listing may be rejected or removed, an account restricted, verification or benefits revoked, and relevant records preserved for review where a violation is suspected. Serious cases may trigger additional action where permitted or required by applicable law.",
                )}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-warning/10 p-4 hairline">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <p className="text-xs leading-6 text-warning">
              {text(
                "هذه القائمة غير حصرية. غياب سلعة أو سلوك من الأمثلة أدناه لا يعني أنه مسموح إذا كان مخالفاً للقانون أو شروط رواج أو يعرّض المستخدمين للخطر.",
                "This list is not exhaustive. An item or behavior is not permitted merely because it is not named below if it violates law, RAWAJ rules, or creates user risk.",
              )}
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map(([ar, en]) => (
            <article key={en} className="flex items-start gap-3 rounded-xl bg-card p-3 hairline">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
                <Ban className="h-4 w-4" />
              </span>
              <span className="pt-0.5 text-xs font-semibold leading-6">{text(ar, en)}</span>
            </article>
          ))}
        </div>

        <section className="rounded-2xl bg-card p-4 hairline">
          <div className="flex items-start gap-2">
            <Flag className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <h2 className="text-sm font-extrabold">{text("كيف تبلغ؟", "How to report")}</h2>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {text(
                  "استخدم زر الإبلاغ من صفحة الإعلان أو الرسالة، وأرسل معلومات واقعية مرتبطة بالمخالفة. احتفظ برقم الإعلان والمحادثة وأي دليل ذي صلة. لا تنشر وثائق حساسة على الملأ ولا تستخدم البلاغات للانتقام أو المضايقة.",
                  "Use the report control on the listing or message and provide factual information relevant to the violation. Keep the listing ID, conversation, and relevant evidence. Do not publish sensitive documents publicly or misuse reports for retaliation or harassment.",
                )}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Link
              to="/safety"
              className="rounded-xl bg-muted-surface px-4 py-2.5 text-center text-xs font-bold hairline"
            >
              {text("إرشادات الأمان", "Safety guidance")}
            </Link>
            <Link
              to="/terms"
              className="rounded-xl bg-muted-surface px-4 py-2.5 text-center text-xs font-bold hairline"
            >
              {text("شروط الاستخدام", "Terms of Use")}
            </Link>
            <Link
              to="/support"
              className="rounded-xl bg-primary px-4 py-2.5 text-center text-xs font-bold text-primary-foreground"
            >
              {text("الدعم والبلاغات", "Support and reports")}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
