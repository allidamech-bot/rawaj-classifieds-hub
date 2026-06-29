import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Search, SlidersHorizontal, MapPin } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ListingCard } from "@/components/ListingCard";
import { categories, governorates, listings } from "@/data/mockData";

const searchSchema = z.object({
  category: z.string().optional(),
  gov: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(["latest", "cheapest", "expensive", "featured"]).optional(),
});

export const Route = createFileRoute("/listings/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "تصفّح الإعلانات | رَوَاج" },
      { name: "description", content: "نتائج البحث والإعلانات على رَوَاج، السوق السوري المجاني." },
    ],
  }),
  component: ListingsPage,
});

function ListingsPage() {
  const search = Route.useSearch();
  const [sort, setSort] = useState<"latest" | "cheapest" | "expensive" | "featured">(
    search.sort ?? "latest",
  );
  const [gov, setGov] = useState<string>(search.gov ?? "كل سوريا");
  const [q, setQ] = useState(search.q ?? "");
  const [open, setOpen] = useState(false);

  const category = search.category ? categories.find((c) => c.id === search.category) : undefined;

  const filtered = useMemo(() => {
    let res = [...listings];
    if (search.category) res = res.filter((l) => l.categoryId === search.category);
    if (gov && gov !== "كل سوريا") res = res.filter((l) => l.governorate === gov);
    if (q.trim()) {
      const t = q.trim();
      res = res.filter((l) => l.title.includes(t) || l.description.includes(t));
    }
    switch (sort) {
      case "cheapest":
        res.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
        break;
      case "expensive":
        res.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case "featured":
        res.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
        break;
      default:
        // latest = keep current order (mock)
        break;
    }
    return res;
  }, [search.category, gov, q, sort]);

  const title = category ? category.nameAr : "كل الإعلانات";

  const sortChips = [
    { id: "latest", label: "الأحدث" },
    { id: "cheapest", label: "الأرخص" },
    { id: "expensive", label: "الأعلى سعراً" },
    { id: "featured", label: "المميز" },
  ] as const;

  return (
    <>
      <PageHeader title={title} />
      <main className="container-wide pt-4">
        {/* Search + gov */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-2.5 hairline">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث ضمن النتائج…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <MapPin className="h-4 w-4 text-gold" /> {gov}
          </button>
        </div>

        {open && (
          <div className="mt-2 rounded-xl bg-card p-2 shadow-premium hairline">
            <div className="flex flex-wrap gap-2">
              {["كل سوريا", ...governorates.map((g) => g.nameAr)].map((g) => (
                <button
                  key={g}
                  onClick={() => { setGov(g); setOpen(false); }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    gov === g ? "bg-primary text-primary-foreground" : "bg-muted-surface text-foreground hover:bg-secondary"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sort chips */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {sortChips.map((c) => (
            <button
              key={c.id}
              onClick={() => setSort(c.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                sort === c.id
                  ? "bg-gold text-gold-foreground"
                  : "bg-card text-foreground hairline hover:bg-muted-surface"
              }`}
            >
              {c.label}
            </button>
          ))}
          <button
            disabled
            title="قريباً"
            className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hairline opacity-70"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> فلاتر أخرى · قريباً
          </button>
        </div>

        {/* Subcategories */}
        {category && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {category.subcategories.map((s) => (
              <span
                key={s.id}
                className="shrink-0 rounded-full bg-muted-surface px-3 py-1 text-[11px] font-medium text-foreground"
              >
                {s.nameAr}
              </span>
            ))}
          </div>
        )}

        {/* Count */}
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>{filtered.length} إعلان</span>
          {category && (
            <Link to="/listings" className="font-semibold text-primary">
              مسح الفلتر
            </Link>
          )}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="mt-10 rounded-2xl bg-card p-10 text-center hairline">
            <p className="text-sm font-semibold text-foreground">لا توجد إعلانات حالياً في هذا القسم</p>
            <p className="mt-1 text-xs text-muted-foreground">جرّب تغيير الفلاتر أو المحافظة.</p>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
