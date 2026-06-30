import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert, ShoppingCart, Store, CreditCard, Flag } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/safety")({
  head: () => ({ meta: [{ title: "نصائح الأمان | رَوَاج" }] }),
  component: SafetyPage,
});

const sections: { icon: typeof ShoppingCart; title: string; items: string[]; tone?: "warn" }[] = [
  {
    icon: ShoppingCart,
    title: "أمان المشتري",
    items: [
      "افحص السلعة قبل الدفع.",
      "قابل البائع في مكان عام وآمن.",
      "لا تحوّل المال قبل التأكد.",
      "احذر الأسعار غير المنطقية.",
      "اطلب صوراً إضافية أو معاينة فيديو عند الشك.",
    ],
  },
  {
    icon: Store,
    title: "أمان البائع",
    items: [
      "لا تشارك بيانات حساسة (هوية، حسابات بنكية، رموز).",
      "تأكد من جدية المشتري قبل تحديد موعد المعاينة.",
      "استخدم أماكن آمنة للتسليم.",
      "احتفظ بسجل المحادثة (سيتم تفعيله لاحقاً عند ربط الرسائل).",
    ],
  },
  {
    icon: CreditCard,
    title: "أمان الدفع والتحويل",
    tone: "warn",
    items: [
      "لا يوجد نظام دفع داخل رَوَاج حالياً.",
      "أي تحويل خارج المنصة هو على مسؤولية المستخدم.",
      "سيتم توضيح أي نظام دفع رسمي لاحقاً عند تفعيله.",
      "لا تشارك أرقام بطاقات أو كلمات مرور مع أي طرف.",
    ],
  },
  {
    icon: Flag,
    title: "التبليغ والإبلاغ",
    items: [
      "بلّغ عن الإعلانات المشبوهة أو المضللة.",
      "بلّغ عن المستخدمين المسيئين أو الذين يحاولون الاحتيال.",
      "ميزة التبليغ قيد التطوير وستُفعَّل لاحقاً مع لوحة الإدارة.",
    ],
  },
];

function SafetyPage() {
  return (
    <>
      <PageHeader title="نصائح الأمان" />
      <main className="container-wide pt-4 pb-8 space-y-4">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-soft">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-gold" />
            <div>
              <h2 className="text-lg font-extrabold">سلامتك أولويتنا</h2>
              <p className="text-xs text-primary-foreground/80">
                رَوَاج منصة وساطة بين الأفراد، ولا نتدخل في عمليات البيع والشراء بشكل مباشر.
              </p>
            </div>
          </div>
        </section>

        {sections.map((s) => (
          <section
            key={s.title}
            className={`rounded-2xl p-4 hairline ${s.tone === "warn" ? "bg-warning/10" : "bg-card"}`}
          >
            <h3 className="mb-2 inline-flex items-center gap-2 text-sm font-extrabold">
              <s.icon className="h-4 w-4 text-gold" /> {s.title}
            </h3>
            <ul className="list-disc ps-5 space-y-1.5 text-sm text-foreground/90">
              {s.items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        ))}

        <p className="text-center text-xs text-muted-foreground">
          هل تحتاج مساعدة فورية؟{" "}
          <Link to="/support" className="font-bold text-primary underline-offset-2 hover:underline">
            تواصل مع الدعم
          </Link>
        </p>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link
            to="/prohibited"
            className="rounded-xl bg-card px-4 py-2.5 text-center text-xs font-bold hairline"
          >
            راجع الإعلانات الممنوعة
          </Link>
          <Link
            to="/listings"
            className="rounded-xl bg-primary px-4 py-2.5 text-center text-xs font-bold text-primary-foreground"
          >
            تصفح بإرشادات الأمان
          </Link>
        </div>
      </main>
    </>
  );
}
