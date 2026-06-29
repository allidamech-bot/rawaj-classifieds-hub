import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { categories, listings } from "@/data/mockData";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "الأقسام | رَوَاج" },
      { name: "description", content: "تصفح جميع أقسام السوق السوري على رَوَاج." },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const counts: Record<string, number> = {};
  for (const l of listings) counts[l.categoryId] = (counts[l.categoryId] ?? 0) + 1;

  return (
    <>
      <PageHeader title="جميع الأقسام" />
      <main className="container-wide pt-4 pb-8">
        <section className="mb-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-soft">
          <h2 className="text-lg font-extrabold">أطلس الأقسام</h2>
          <p className="mt-1 text-xs text-primary-foreground/80">
            اختر القسم المناسب لتصفح الإعلانات المنظّمة داخل سوريا. كل قسم يحوي أقساماً فرعية تساعدك
            في الوصول بسرعة.
          </p>
          <p className="mt-2 text-[11px] text-primary-foreground/70">
            الأعداد والأقسام الفرعية هنا نموذج استكشاف UI؛ قائمة الإعلانات الحقيقية تُقرأ من مصدر
            البيانات التشغيلي عند فتح نتائج البحث.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {categories.map((c) => {
            const count = counts[c.id] ?? 0;
            return (
              <Link
                key={c.id}
                to="/listings"
                search={{ category: c.id }}
                className="group rounded-2xl bg-card p-4 hairline shadow-soft transition-shadow hover:shadow-premium"
              >
                <div className="flex items-start gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                    <PlaceholderArt type={c.placeholder} aspect="square" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-extrabold">{c.nameAr}</h3>
                      <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180 transition group-hover:text-foreground" />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.hintAr}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px]">
                      <span className="font-bold text-gold">{count} إعلان</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {c.subcategories.length} قسم فرعي
                      </span>
                    </div>
                  </div>
                </div>
                {c.subcategories.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.subcategories.slice(0, 6).map((s) => (
                      <span
                        key={s.id}
                        className="rounded-full bg-muted-surface px-2 py-0.5 text-[10px] font-medium text-foreground/80"
                      >
                        {s.nameAr}
                      </span>
                    ))}
                    {c.subcategories.length > 6 && (
                      <span className="rounded-full bg-muted-surface px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        +{c.subcategories.length - 6}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          هل قسمك غير موجود؟ سيتم إضافة المزيد من الأقسام لاحقاً حسب احتياجات المستخدمين.
        </p>
      </main>
    </>
  );
}
