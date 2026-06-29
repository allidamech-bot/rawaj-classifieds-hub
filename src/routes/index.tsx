import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  Search,
  Sparkles,
  MapPin,
  Clock,
  Plus,
  ShieldAlert,
  BadgeCheck,
  Star,
  type LucideIcon,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { CategoryCard } from "@/components/CategoryCard";
import { ListingCard } from "@/components/ListingCard";
import { SectionHeader } from "@/components/SectionHeader";
import {
  categories,
  featuredListings,
  governorates,
  homeQuickCategoryIds,
  latestListings,
  listings,
  verifiedSellers,
} from "@/data/mockData";

const HOME_TITLE = "رَوَاج | سوق سوريا المجاني للإعلانات";
const HOME_DESCRIPTION =
  "سوق إعلانات مبوبة مجاني لسوريا. بيع واشترِ سيارات، عقارات، موبايلات، وظائف وخدمات حسب المحافظة بسهولة وبدون تعقيد.";

type QuickFilter =
  | {
      id: string;
      label: string;
      icon: LucideIcon;
      search: { sort?: "latest" | "featured" };
      disabled?: false;
    }
  | {
      id: string;
      label: string;
      icon: LucideIcon;
      disabled: true;
    };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      {
        name: "description",
        content: HOME_DESCRIPTION,
      },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESCRIPTION },
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: HOME_DESCRIPTION },
    ],
  }),
  component: HomePage,
});

const quickFilters: QuickFilter[] = [
  { id: "latest", label: "الأحدث", icon: Clock, search: { sort: "latest" as const } },
  { id: "featured", label: "المميز", icon: Sparkles, search: { sort: "featured" as const } },
  { id: "gov", label: "حسب المحافظة", icon: MapPin, search: {} },
  { id: "nearby", label: "الأقرب · قريباً", icon: MapPin, disabled: true },
];

function HomePage() {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const counts: Record<string, number> = {};
  for (const l of listings) counts[l.categoryId] = (counts[l.categoryId] ?? 0) + 1;

  const quickCats = homeQuickCategoryIds
    .map((id) => categories.find((c) => c.id === id))
    .filter(Boolean) as typeof categories;

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = searchValue.trim();
    navigate({ to: "/listings", search: q ? { q } : {} });
  };

  return (
    <>
      <AppHeader />

      <main className="container-wide pt-4">
        {/* Hero / value proposition */}
        <section className="mb-4 rounded-2xl bg-gradient-to-bl from-card to-muted-surface p-4 sm:p-5 hairline shadow-soft">
          <h1 className="text-lg font-extrabold leading-tight text-foreground sm:text-xl">
            رَوَاج — سوق سوريا المجاني للإعلانات
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            بيع واشتري داخل سوريا بسهولة: إعلانات محلية حسب المحافظة، بدون عمولات وبدون تعقيد.
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            بعض بطاقات الصفحة الرئيسية نموذج عرض. نتائج الإعلانات الحقيقية تظهر عند فتح صفحة التصفح
            بعد اكتمال الربط التشغيلي.
          </p>
        </section>

        {/* Search */}
        <form onSubmit={handleSearch} className="rounded-2xl bg-card p-2 shadow-soft hairline">
          <div className="flex items-center gap-2 rounded-xl bg-muted-surface px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              type="search"
              aria-label="ابحث في رَوَاج"
              placeholder="ابحث عن سيارة، منزل، هاتف، وظيفة…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </form>

        {/* Quick filters */}
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {quickFilters.map((f) =>
            f.disabled ? (
              <button
                key={f.id}
                disabled
                title="قريباً"
                className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 text-xs font-semibold opacity-60 hairline"
              >
                <f.icon className="h-3.5 w-3.5 text-gold" />
                {f.label}
              </button>
            ) : (
              <Link
                key={f.id}
                to="/listings"
                search={f.search}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 text-xs font-semibold transition hairline hover:bg-muted-surface"
              >
                <f.icon className="h-3.5 w-3.5 text-gold" />
                {f.label}
              </Link>
            ),
          )}
        </div>

        {/* Categories grid */}
        <section className="mt-6">
          <SectionHeader title="تصفح الأقسام" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quickCats.map((c) => (
              <CategoryCard key={c.id} category={c} count={counts[c.id] ?? 0} />
            ))}
            <Link
              to="/categories"
              className="flex items-center justify-center gap-2 rounded-2xl bg-muted-surface p-4 text-sm font-bold text-primary hairline transition hover:bg-card"
            >
              عرض كل الأقسام
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-6 overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-premium">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-extrabold">انشر إعلانك مجاناً</h3>
              <p className="mt-1 text-sm text-primary-foreground/80">
                إعلانك يظهر للمشترين داخل سوريا خلال دقائق.
              </p>
              <Link
                to="/add-listing"
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-bold text-gold-foreground transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" /> أضف إعلان
              </Link>
            </div>
            <div className="hidden sm:block">
              <span className="grid h-20 w-20 place-items-center rounded-2xl bg-primary-foreground/10">
                <Sparkles className="h-8 w-8 text-gold" />
              </span>
            </div>
          </div>
        </section>

        {/* Featured */}
        <section className="mt-7">
          <SectionHeader title="إعلانات مميزة" action={{ label: "عرض الكل" }} />
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {featuredListings.map((l) => (
              <ListingCard key={l.id} listing={l} variant="horizontal" />
            ))}
          </div>
        </section>

        {/* Latest */}
        <section className="mt-7">
          <SectionHeader title="أحدث الإعلانات" action={{ label: "عرض الكل" }} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {latestListings.slice(0, 9).map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>

        {/* Governorates */}
        <section className="mt-7">
          <SectionHeader title="تصفح حسب المحافظة" />
          <div className="flex flex-wrap gap-2">
            <Link
              to="/listings"
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
            >
              كل سوريا
            </Link>
            {governorates.map((g) => (
              <Link
                key={g.id}
                to="/listings"
                className="rounded-full bg-card px-4 py-1.5 text-xs font-semibold text-foreground hairline transition hover:bg-muted-surface"
              >
                {g.nameAr}
              </Link>
            ))}
          </div>
        </section>

        {/* Verified sellers */}
        <section className="mt-7">
          <SectionHeader title="بائعون موثّقون" />
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {verifiedSellers.map((s) => (
              <Link
                key={s.id}
                to="/seller/$id"
                params={{ id: s.id }}
                className="w-[200px] shrink-0 rounded-2xl bg-card p-3 hairline shadow-soft transition hover:shadow-premium"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-muted-surface text-base font-bold text-primary">
                    {s.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-sm font-bold">{s.name}</span>
                      <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-trust" />
                    </div>
                    <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Star className="h-3 w-3 fill-gold text-gold" /> {s.rating.toFixed(1)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Safety strip */}
        <section className="mt-7 rounded-2xl bg-warning/10 p-4 hairline">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 shrink-0 text-warning" />
            <h3 className="text-sm font-extrabold">تعامل بأمان</h3>
          </div>
          <ul className="mt-2 grid gap-1 text-xs text-foreground sm:grid-cols-2">
            <li>• لا تحوّل المال قبل معاينة السلعة.</li>
            <li>• قابل البائع في مكان عام وآمن.</li>
            <li>• احذر الأسعار غير المنطقية.</li>
            <li>
              • بلّغ عن أي إعلان مشبوه عبر{" "}
              <Link to="/support" className="font-bold text-primary">
                الدعم
              </Link>
              .
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}
