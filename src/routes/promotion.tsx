import { createFileRoute, Link } from "@tanstack/react-router";
import { Home as HomeIcon, LayoutTemplate, LifeBuoy, Sparkles, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";

export const Route = createFileRoute("/promotion")({
  head: () => ({ meta: [{ title: "ترويج إعلان | رواج" }] }),
  component: PromotionPage,
});

const benefits = [
  {
    icon: Sparkles,
    ar: "شارة مميزة",
    en: "Featured badge",
    bodyAr: "تمييز واضح على بطاقة الإعلان عند توفر مسار ترويج معتمد.",
    bodyEn: "Clear treatment on the listing card when an approved promotion flow is available.",
  },
  {
    icon: TrendingUp,
    ar: "ظهور أعلى",
    en: "Higher visibility",
    bodyAr: "إبراز الإعلان ضمن نتائج مناسبة بعد مراجعة الطلب وربطه بإعلان معتمد.",
    bodyEn: "Highlight a listing in relevant results after review and approval.",
  },
  {
    icon: HomeIcon,
    ar: "مساحات رئيسية",
    en: "Home placement",
    bodyAr: "عرض منظم للإعلانات المختارة وفق قواعد واضحة ومراجعة إدارية.",
    bodyEn: "Structured placement for selected listings under clear review rules.",
  },
  {
    icon: LayoutTemplate,
    ar: "إعداد الطلب",
    en: "Request preparation",
    bodyAr: "جهز تفاصيل الإعلان والمدة والهدف قبل التواصل مع فريق رواج.",
    bodyEn: "Prepare the listing, duration, and goal before contacting RAWAJ.",
  },
];

function PromotionPage() {
  const { language, text } = useUiPreferences();

  return (
    <>
      <PageHeader title={text("ترويج إعلان", "Promote listing")} />
      <main className="container-wide space-y-5 pt-4 pb-8">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-soft">
          <h2 className="text-lg font-extrabold">
            {text("جهز تفاصيل الترويج قبل التواصل", "Prepare promotion details before contact")}
          </h2>
          <p className="mt-2 text-xs leading-6 text-primary-foreground/80">
            {text(
              "الترويج يحتاج مراجعة دفع وصلاحيات خادم آمنة قبل حفظ الطلب أو تفعيل أي إعلان. استخدم هذه الصفحة لتجهيز التفاصيل التي سترسلها عبر الدعم.",
              "Promotion requires payment review and safe server permissions before any request is stored or listing is featured. Use this page to prepare the details you will send through support.",
            )}
          </p>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {benefits.map((benefit) => (
            <article key={benefit.en} className="rounded-2xl bg-card p-4 hairline shadow-soft">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
                  <benefit.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold">
                    {language === "ar" ? benefit.ar : benefit.en}
                  </h3>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    {language === "ar" ? benefit.bodyAr : benefit.bodyEn}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-2xl bg-card p-4 hairline">
          <h3 className="text-sm font-extrabold">
            {text("تفاصيل مفيدة للترويج", "Useful promotion details")}
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ChecklistItem label={text("رابط الإعلان أو رقمه", "Listing link or ID")} />
            <ChecklistItem label={text("نوع الترويج المطلوب", "Preferred promotion type")} />
            <ChecklistItem label={text("مدة الظهور المطلوبة", "Requested duration")} />
            <ChecklistItem
              label={text("معلومات التواصل للمتابعة", "Contact details for follow-up")}
            />
          </div>
        </section>

        <section className="rounded-2xl bg-warning/10 p-4 text-xs leading-6 hairline">
          {text(
            "لا يتم إنشاء طلب ترويج أو رقم متابعة من هذه الصفحة. أي دفع أو تفعيل إعلان مميز يحتاج مسار خادم محمي ومراجعة إدارية.",
            "This page does not create a promotion request or tracking number. Any payment or featuring activation requires a protected server flow and admin review.",
          )}
        </section>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link
            to="/support"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <LifeBuoy className="h-4 w-4" />
            {text("التواصل مع الدعم", "Contact support")}
          </Link>
          <Link
            to="/listings"
            className="rounded-xl bg-card px-4 py-2.5 text-center text-sm font-bold hairline"
          >
            {text("تصفح الإعلانات", "Browse listings")}
          </Link>
        </div>
      </main>
    </>
  );
}

function ChecklistItem({ label }: { label: string }) {
  return (
    <div className="rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold text-foreground">
      {label}
    </div>
  );
}
