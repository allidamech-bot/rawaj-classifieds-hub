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
import { governorateName } from "@/lib/i18n";
import { useUiPreferences } from "@/lib/ui-preferences";
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

type QuickFilter = {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: LucideIcon;
  search: { sort?: "latest" | "featured" };
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
  {
    id: "latest",
    labelAr: "الأحدث",
    labelEn: "Latest",
    icon: Clock,
    search: { sort: "latest" as const },
  },
  {
    id: "featured",
    labelAr: "المميز",
    labelEn: "Featured",
    icon: Sparkles,
    search: { sort: "featured" as const },
  },
  { id: "gov", labelAr: "حسب المحافظة", labelEn: "By governorate", icon: MapPin, search: {} },
  { id: "nearby", labelAr: "حسب المنطقة", labelEn: "By area", icon: MapPin, search: {} },
];

function HomePage() {
  const navigate = useNavigate();
  const { language, text } = useUiPreferences();
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
            {text(
              "رَوَاج — سوق سوريا المجاني للإعلانات",
              "RAWAJ - Syria's classifieds marketplace",
            )}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {text(
              "بيع واشتري داخل سوريا بسهولة: إعلانات محلية حسب المحافظة، بدون عمولات وبدون تعقيد.",
              "Buy and sell across Syria with clear local listings by governorate, no commissions, and no clutter.",
            )}
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
              aria-label={text("ابحث في رَوَاج", "Search RAWAJ")}
              placeholder={text(
                "ابحث عن سيارة، منزل، هاتف، وظيفة...",
                "Search for a car, home, phone, job...",
              )}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </form>

        {/* Quick filters */}
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {quickFilters.map((f) => (
            <Link
              key={f.id}
              to="/listings"
              search={f.search}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 text-xs font-semibold transition hairline hover:bg-muted-surface"
            >
              <f.icon className="h-3.5 w-3.5 text-gold" />
              {text(f.labelAr, f.labelEn)}
            </Link>
          ))}
        </div>

        {/* Categories grid */}
        <section className="mt-6">
          <SectionHeader title={text("تصفح الأقسام", "Browse categories")} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quickCats.map((c) => (
              <CategoryCard key={c.id} category={c} count={counts[c.id] ?? 0} />
            ))}
            <Link
              to="/categories"
              className="flex items-center justify-center gap-2 rounded-2xl bg-muted-surface p-4 text-sm font-bold text-primary hairline transition hover:bg-card"
            >
              {text("عرض كل الأقسام", "View all categories")}
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-6 overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-premium">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-extrabold">
                {text("انشر إعلانك مجاناً", "Post your listing free")}
              </h3>
              <p className="mt-1 text-sm text-primary-foreground/80">
                {text(
                  "إعلانك يظهر للمشترين داخل سوريا خلال دقائق.",
                  "Prepare a clear listing for buyers across Syria.",
                )}
              </p>
              <Link
                to="/add-listing"
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-bold text-gold-foreground transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" /> {text("أضف إعلان", "Post a listing")}
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
          <SectionHeader
            title={text("إعلانات مميزة", "Featured listings")}
            action={{ label: text("عرض الكل", "View all"), to: "/listings" }}
          />
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {featuredListings.map((l) => (
              <ListingCard key={l.id} listing={l} variant="horizontal" />
            ))}
          </div>
        </section>

        {/* Latest */}
        <section className="mt-7">
          <SectionHeader
            title={text("أحدث الإعلانات", "Latest listings")}
            action={{ label: text("عرض الكل", "View all"), to: "/listings" }}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {latestListings.slice(0, 9).map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>

        {/* Governorates */}
        <section className="mt-7">
          <SectionHeader title={text("تصفح حسب المحافظة", "Browse by governorate")} />
          <div className="flex flex-wrap gap-2">
            <Link
              to="/listings"
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
            >
              {text("كل سوريا", "All Syria")}
            </Link>
            {governorates.map((g) => (
              <Link
                key={g.id}
                to="/listings"
                className="rounded-full bg-card px-4 py-1.5 text-xs font-semibold text-foreground hairline transition hover:bg-muted-surface"
              >
                {governorateName(g.id, g.nameAr, language)}
              </Link>
            ))}
          </div>
        </section>

        {/* Verified sellers */}
        <section className="mt-7">
          <SectionHeader title={text("بائعون موثّقون", "Verified sellers")} />
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
            <h3 className="text-sm font-extrabold">{text("تعامل بأمان", "Trade safely")}</h3>
          </div>
          <ul className="mt-2 grid gap-1 text-xs text-foreground sm:grid-cols-2">
            <li>
              {text(
                "• لا تحوّل المال قبل معاينة السلعة.",
                "• Do not transfer money before inspecting the item.",
              )}
            </li>
            <li>{text("• قابل البائع في مكان عام وآمن.", "• Meet in a public, safe place.")}</li>
            <li>
              {text("• احذر الأسعار غير المنطقية.", "• Be cautious with unrealistic prices.")}
            </li>
            <li>
              {text("• بلّغ عن أي إعلان مشبوه عبر", "• Report suspicious listings through")}{" "}
              <Link to="/support" className="font-bold text-primary">
                {text("الدعم", "support")}
              </Link>
              .
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}
