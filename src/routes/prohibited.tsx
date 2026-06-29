import { createFileRoute, Link } from "@tanstack/react-router";
import { Ban, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/prohibited")({
  head: () => ({ meta: [{ title: "الإعلانات الممنوعة | رَوَاج" }] }),
  component: ProhibitedPage,
});

const items = [
  "الأسلحة والذخائر والمتفجرات بكافة أنواعها",
  "المواد المخدرة والمواد غير القانونية",
  "الأدوية المقيدة دون وصفة وأي مواد طبية ممنوعة",
  "البضائع المسروقة أو مجهولة المصدر",
  "العروض الاحتيالية والعمليات الوهمية",
  "الوثائق المزوّرة (هويات، شهادات، عملات)",
  "محتوى مسيء، عنصري، أو محرّض على الكراهية",
  "خدمات غير قانونية أو مخالفة للنظام العام",
  "الاتجار بالبشر أو أي شكل من أشكال الاستغلال",
  "المنتجات الخطرة على السلامة العامة",
  "المنتجات المقلّدة والعلامات التجارية المسروقة",
  "العروض المالية المشبوهة (احتيال، عمولات وهمية، استثمار وهمي)",
  "محتوى جنسي صريح أو مخالف للقانون",
  "أي محتوى مضلّل أو معلومات إعلان غير صحيحة",
  "كل ما يخالف القوانين السورية أو أنظمة المنصة",
];

function ProhibitedPage() {
  return (
    <>
      <PageHeader title="الإعلانات الممنوعة" />
      <main className="container-wide pt-4 pb-8 space-y-4">
        <div className="rounded-2xl bg-destructive/10 p-4 hairline">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-bold text-destructive">إعلانات ممنوعة على رَوَاج</p>
              <p className="mt-1 text-xs text-foreground/80">
                ستتم لاحقاً إزالة أي إعلان يخالف هذه القائمة بعد المراجعة، مع إمكانية إيقاف الحساب
                المخالف. ميزة الإشراف الفعلية قيد التطوير وستُفعَّل عند ربط لوحة الإدارة.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((t) => (
            <div key={t} className="flex items-start gap-3 rounded-xl bg-card p-3 hairline">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
                <Ban className="h-4 w-4" />
              </span>
              <span className="pt-1 text-sm font-medium">{t}</span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-card p-4 hairline text-xs text-muted-foreground">
          <p className="font-bold text-foreground mb-1">كيف تبلّغ عن إعلان مخالف؟</p>
          <p>
            من صفحة الإعلان، اضغط على زر (إبلاغ عن الإعلان). ميزة التبليغ تحت التطوير وستُفعَّل
            قريباً. في الحالات العاجلة، يمكنك التواصل عبر{" "}
            <Link
              to="/support"
              className="font-bold text-primary underline-offset-2 hover:underline"
            >
              صفحة الدعم
            </Link>
            .
          </p>
        </div>
      </main>
    </>
  );
}
