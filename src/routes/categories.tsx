import { createFileRoute } from "@tanstack/react-router";
import { CategoryCard } from "@/components/CategoryCard";
import { PageHeader } from "@/components/PageHeader";
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
      <main className="container-wide pt-4">
        <p className="mb-4 text-sm text-muted-foreground">
          اختر القسم المناسب لتصفح الإعلانات المنظّمة داخل سوريا.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <CategoryCard key={c.id} category={c} count={counts[c.id] ?? 0} />
          ))}
        </div>
      </main>
    </>
  );
}
