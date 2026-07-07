import fs from "node:fs";

const path = "src/routes/listings.index.tsx";
let source = fs.readFileSync(path, "utf8");

const start = source.indexOf('        <section className="bg-card p-4 hairline">');
const end = source.indexOf('        <section className="mt-3 hidden rounded-2xl bg-card p-3 shadow-soft hairline lg:block">');
if (start < 0 || end < 0 || end <= start) throw new Error("Results header block not found");

const replacement = `        <section className="rounded-[1.4rem] bg-card p-3.5 hairline shadow-premium-sm sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold text-brand-orange">
                {selectedCategory
                  ? text("نتائج ضمن قسم", "Results in category")
                  : text("نتائج السوق", "Marketplace results")}
              </p>
              <h1 className="mt-0.5 truncate text-lg font-extrabold text-primary sm:text-xl">{title}</h1>
              {selectedTaxonomyPath.length > 1 ? (
                <p className="mt-1 truncate text-[10px] font-bold text-muted-foreground">
                  {taxonomyPathLabel(selectedTaxonomyPath, language)}
                </p>
              ) : null}
            </div>
            <span className="shrink-0 rounded-full bg-primary/7 px-2.5 py-1 text-[10px] font-extrabold text-primary">
              {loading
                ? text("جارٍ التحميل", "Loading")
                : text(\`\${items.length} نتيجة\`, \`\${items.length} results\`)}
            </span>
          </div>

          <div className="mt-3 flex items-stretch gap-2">
            <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-background/75 px-3.5 transition focus-within:bg-card focus-within:ring-[3px] focus-within:ring-brand-orange/20">
              <Search className="h-4.5 w-4.5 shrink-0 text-primary" strokeWidth={1.9} />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder={text("ابحث ضمن النتائج...", "Search within results...")}
                aria-label={text("بحث في الإعلانات", "Search listings")}
                className="w-full bg-transparent text-sm font-semibold outline-none placeholder:font-medium"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setSortOpen(false);
                setFiltersOpen(true);
              }}
              aria-label={text("الفلاتر", "Filters")}
              className="relative grid min-h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-soft transition active:scale-[0.98]"
            >
              <Filter className="h-4.5 w-4.5" strokeWidth={2} />
              {activeFilterCount > 0 ? (
                <span className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-orange px-1 text-[9px] font-extrabold text-white ring-2 ring-card">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => {
                setFiltersOpen(false);
                setSortOpen((value) => !value);
              }}
              aria-expanded={sortOpen}
              aria-label={text("الترتيب", "Sort")}
              className="grid min-h-12 w-12 shrink-0 place-items-center rounded-2xl bg-background/75 text-primary transition active:scale-[0.98]"
            >
              <ArrowUpDown className="h-4.5 w-4.5" strokeWidth={1.9} />
            </button>
          </div>

          <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className={\`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition \${
                districtAr || govId
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground"
              }\`}
            >
              {canonicalLocationNodeId
                ? locationLabel || text("الموقع", "Location")
                : selectedGovernorate
                  ? governorateName(selectedGovernorate.id, selectedGovernorate.nameAr, language)
                  : text("كل سوريا", "All Syria")}
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className={\`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition \${
                priceMin.trim() || priceMax.trim()
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground"
              }\`}
            >
              {priceMin.trim() || priceMax.trim() ? text("السعر محدد", "Price set") : text("السعر", "Price")}
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className={\`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition \${
                selectedCategory
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground"
              }\`}
            >
              {selectedCategory
                ? categoryName(selectedCategory.id, selectedCategory.nameAr, language)
                : text("القسم", "Category")}
            </button>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="shrink-0 rounded-full bg-brand-orange/10 px-3 py-1.5 text-[11px] font-extrabold text-brand-orange"
              >
                {text("مسح الكل", "Clear all")}
              </button>
            ) : null}
          </div>

          {sortOpen ? (
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-background/80 p-2 sm:grid-cols-4">
              {sortChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    setSort(chip.id);
                    setSortOpen(false);
                  }}
                  className={\`rounded-xl px-3 py-2 text-xs font-bold transition \${
                    sort === chip.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-foreground hairline"
                  }\`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          ) : null}
        </section>

`;

source = source.slice(0, start) + replacement + source.slice(end);
source = source
  .replace(
    'className="fixed inset-0 z-50 bg-primary/45 p-3 lg:hidden"',
    'className="fixed inset-0 z-50 flex items-end bg-primary/35 p-0 backdrop-blur-[2px] lg:hidden"',
  )
  .replace(
    'className="ms-auto flex h-full max-w-sm flex-col overflow-hidden rounded-2xl bg-card shadow-premium hairline"',
    'className="mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[1.75rem] bg-card shadow-premium"',
  )
  .replace(
    'className="flex items-center justify-between border-b border-border p-4"',
    'className="relative flex items-center justify-between border-b border-border/70 px-4 pb-3 pt-5"',
  )
  .replace(
    'className="mobile-page-bottom space-y-4 overflow-y-auto p-4 lg:pb-4"',
    'className="space-y-5 overflow-y-auto px-4 pb-5 pt-4"',
  )
  .replace(
    'className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-border bg-card p-4"',
    'className="sticky bottom-0 grid grid-cols-[0.8fr_1.2fr] gap-2 border-t border-border/70 bg-card/96 p-4 backdrop-blur-xl"',
  )
  .replace(
    'className="rounded-xl bg-card px-4 py-2.5 text-xs font-bold hairline disabled:opacity-50"',
    'className="min-h-12 rounded-2xl bg-background px-4 py-2.5 text-xs font-bold text-muted-foreground disabled:opacity-50"',
  )
  .replace(
    'className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"',
    'className="min-h-12 rounded-2xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground shadow-soft"',
  );

fs.writeFileSync(path, source);
console.log("Mobile results redesign applied.");
