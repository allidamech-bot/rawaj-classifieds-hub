import { Link } from "@tanstack/react-router";
import { MapPin, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import type { FormEvent } from "react";

interface DiscoveryHeroProps {
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  text: (ar: string, en: string) => string;
}

const quickSearches = [
  { query: "سيارة", ar: "سيارات", en: "Cars" },
  { query: "عقار", ar: "عقارات", en: "Real estate" },
  { query: "موبايل", ar: "هواتف", en: "Phones" },
  { query: "وظيفة", ar: "وظائف", en: "Jobs" },
] as const;

export function DiscoveryHero({
  searchValue,
  onSearchValueChange,
  onSubmit,
  text,
}: DiscoveryHeroProps) {
  const query = searchValue.trim();
  const filterSearch = query ? { q: query, open_filters: true } : { open_filters: true };

  return (
    <section className="rawaj-discovery-hero" aria-labelledby="rawaj-home-title">
      <div className="rawaj-discovery-hero__geometry" aria-hidden="true">
        <span data-shape="one" />
        <span data-shape="two" />
        <span data-shape="three" />
      </div>

      <div className="rawaj-discovery-hero__content">
        <div className="rawaj-discovery-hero__copy">
          <p className="rawaj-discovery-kicker">
            <Sparkles className="h-4 w-4" strokeWidth={1.9} />
            {text("اكتشف رواج", "Discover RAWAJ")}
          </p>
          <h1 id="rawaj-home-title">
            {text("كل السوق السعودي، في مكان واحد.", "Saudi Arabia’s marketplace, all in one place.")}
          </h1>
          <p>
            {text(
              "اكتشف الإعلانات، قارن الخيارات، وتواصل مباشرة مع البائع.",
              "Discover listings, compare options, and connect directly with sellers.",
            )}
          </p>
          <div
            className="rawaj-discovery-benefits"
            aria-label={text("مزايا رواج", "RAWAJ benefits")}
          >
            <span>{text("إعلان مجاني", "Free listing")}</span>
            <span>{text("تواصل مباشر", "Direct contact")}</span>
            <span>{text("جميع المناطق", "All governorates")}</span>
          </div>
        </div>

        <div className="rawaj-search-overlay">
          <form onSubmit={onSubmit} className="rawaj-search-overlay__form" role="search">
            <label className="rawaj-search-overlay__field" htmlFor="rawaj-home-search">
              <Search className="h-5 w-5 shrink-0" strokeWidth={1.9} />
              <input
                id="rawaj-home-search"
                name="q"
                value={searchValue}
                onChange={(event) => onSearchValueChange(event.target.value)}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                dir="auto"
                aria-label={text("ابحث في رواج", "Search RAWAJ")}
                placeholder={text(
                  "ابحث عن سيارة، منزل، هاتف أو خدمة...",
                  "Search for a car, home, phone, or service...",
                )}
              />
            </label>
            <button type="submit" className="rawaj-search-overlay__submit">
              <Search className="h-5 w-5" strokeWidth={2.1} />
              <span>{text("بحث", "Search")}</span>
            </button>
          </form>

          <div className="rawaj-search-overlay__controls">
            <Link to="/listings" search={filterSearch} className="rawaj-search-location">
              <MapPin className="h-4 w-4" strokeWidth={1.9} />
              <span>{text("كل السعودية", "All Saudi Arabia")}</span>
            </Link>
            <Link
              to="/listings"
              search={filterSearch}
              className="rawaj-search-filter"
              aria-label={text("فتح الفلاتر", "Open filters")}
            >
              <SlidersHorizontal className="h-4 w-4" strokeWidth={1.9} />
              <span>{text("فلترة", "Filters")}</span>
            </Link>
          </div>

          <div className="rawaj-search-shortcuts">
            {quickSearches.map((shortcut) => (
              <Link key={shortcut.query} to="/listings" search={{ q: shortcut.query }}>
                {text(shortcut.ar, shortcut.en)}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
