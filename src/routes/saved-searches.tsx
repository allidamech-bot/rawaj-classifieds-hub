import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, Bell, Pencil, Trash2, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/saved-searches")({
  head: () => ({ meta: [{ title: "عمليات البحث المحفوظة | رَوَاج" }] }),
  component: SavedSearchesPage,
});

const mockSearches = [
  {
    id: "s1",
    q: "سيارة كيا",
    category: "سيارات ومركبات",
    governorate: "دمشق",
    priceMin: 0,
    priceMax: 200000000,
    sort: "الأحدث",
  },
  {
    id: "s2",
    q: "شقة للإيجار",
    category: "عقارات",
    governorate: "حلب",
    priceMin: 0,
    priceMax: 0,
    sort: "الأرخص",
  },
];

function SavedSearchesPage() {
  return (
    <>
      <PageHeader title="عمليات البحث المحفوظة" />
      <main className="container-wide pt-4 pb-8 space-y-4">
        <div className="rounded-2xl bg-card p-4 hairline">
          <h2 className="text-sm font-extrabold">عمليات البحث المحفوظة</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            احفظ بحثك لتعود إليه بسرعة لاحقاً. تنبيهات البحث سيتم تفعيلها لاحقاً.
          </p>
        </div>

        {mockSearches.length === 0 ? (
          <div className="rounded-2xl bg-card p-10 text-center hairline">
            <span className="grid h-14 w-14 mx-auto place-items-center rounded-full bg-muted-surface">
              <Bookmark className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="mt-3 text-sm font-bold">لا توجد عمليات بحث محفوظة</p>
            <Link
              to="/listings"
              className="mt-5 inline-block rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground"
            >
              ابدأ البحث
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {mockSearches.map((s) => (
              <li key={s.id} className="rounded-2xl bg-card p-4 hairline">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-gold" />
                      <span className="truncate text-sm font-bold">{s.q || "بحث بدون كلمة"}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>القسم: {s.category}</span>
                      <span>المحافظة: {s.governorate}</span>
                      <span>
                        السعر:{" "}
                        {s.priceMax ? `حتى ${s.priceMax.toLocaleString("ar-SY")} ل.س` : "غير محدد"}
                      </span>
                      <span>الترتيب: {s.sort}</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    <Bell className="h-3 w-3" /> تنبيهات قريباً
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Link
                    to="/listings"
                    className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                  >
                    فتح البحث
                  </Link>
                  <button
                    disabled
                    title="قريباً"
                    className="inline-flex items-center gap-1 rounded-xl bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground hairline cursor-not-allowed"
                  >
                    <Pencil className="h-3.5 w-3.5" /> تعديل · قريباً
                  </button>
                  <button
                    disabled
                    title="قريباً"
                    className="inline-flex items-center gap-1 rounded-xl bg-card px-3 py-1.5 text-xs font-bold text-destructive hairline cursor-not-allowed"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> حذف · قريباً
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
