import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const current = await readFile(path, "utf8");
  if (!current.includes(before)) throw new Error(`Missing patch anchor in ${path}: ${before.slice(0, 100)}`);
  await writeFile(path, current.replace(before, after));
}

await writeFile(
  "src/features/search/QuickFilterRail.tsx",
  `import { Camera, MapPin, Shapes, Sparkles, Tag, X } from "lucide-react";
import type { CategoryFieldKind } from "@/lib/category-fields";

export type QuickFilterTarget = "location" | "price" | "category" | "condition";

interface QuickFilterRailProps {
  locationLabel: string;
  priceActive: boolean;
  categoryLabel: string;
  categoryActive: boolean;
  conditionActive: boolean;
  showCondition: boolean;
  withPhotos: boolean;
  newestActive: boolean;
  hasActiveFilters: boolean;
  onOpenFilter: (target: QuickFilterTarget) => void;
  onNewest: () => void;
  onTogglePhotos: () => void;
  onReset: () => void;
  fieldKind: CategoryFieldKind;
  text: (ar: string, en: string) => string;
}

export function QuickFilterRail({
  locationLabel,
  priceActive,
  categoryLabel,
  categoryActive,
  conditionActive,
  showCondition,
  withPhotos,
  newestActive,
  hasActiveFilters,
  onOpenFilter,
  onNewest,
  onTogglePhotos,
  onReset,
  fieldKind,
  text,
}: QuickFilterRailProps) {
  return (
    <nav
      className="rawaj-quick-filter-rail"
      aria-label={text("فلاتر سريعة", "Quick filters")}
      data-state-contract="contextual-url-filters"
      data-has-active-filters={hasActiveFilters}
    >
      <button type="button" onClick={onNewest} data-active={newestActive}>
        <Sparkles aria-hidden="true" />
        <span>{text("الأحدث", "Newest")}</span>
      </button>
      <button
        type="button"
        onClick={() => onOpenFilter("location")}
        data-active={locationLabel !== text("كل سوريا", "All Syria")}
      >
        <MapPin aria-hidden="true" />
        <span>{locationLabel}</span>
      </button>
      <button type="button" onClick={() => onOpenFilter("price")} data-active={priceActive}>
        <Tag aria-hidden="true" />
        <span>{priceActive ? text("السعر محدد", "Price set") : text("السعر", "Price")}</span>
      </button>
      <button type="button" onClick={() => onOpenFilter("category")} data-active={categoryActive}>
        <Shapes aria-hidden="true" />
        <span>{categoryLabel}</span>
      </button>
      {showCondition ? (
        <button
          type="button"
          onClick={() => onOpenFilter("condition")}
          data-active={conditionActive}
          data-kind={fieldKind}
        >
          <span className="rawaj-quick-filter-rail__dot" aria-hidden="true" />
          <span>
            {conditionActive ? text("الحالة محددة", "Condition set") : text("الحالة", "Condition")}
          </span>
        </button>
      ) : null}
      <button type="button" onClick={onTogglePhotos} data-active={withPhotos}>
        <Camera aria-hidden="true" />
        <span>{text("مع صور", "With photos")}</span>
      </button>
      {hasActiveFilters ? (
        <button type="button" onClick={onReset} data-tone="clear">
          <X aria-hidden="true" />
          <span>{text("مسح الكل", "Clear all")}</span>
        </button>
      ) : null}
    </nav>
  );
}
`,
);

await writeFile(
  "src/features/search/FilterBottomSheet.tsx",
  `import { ChevronUp, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
} from "@/components/shell/spatial-primitives";
import { beginFilterDraftSession } from "@/features/search/filter-draft-session";
import type { QuickFilterTarget } from "@/features/search/QuickFilterRail";

interface FilterBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount: number;
  onReset: () => void;
  onApply: () => void;
  focusTarget: QuickFilterTarget | null;
  children: ReactNode;
  text: (ar: string, en: string) => string;
}

export function FilterBottomSheet({
  open,
  onOpenChange,
  activeCount,
  onReset,
  onApply,
  focusTarget,
  children,
  text,
}: FilterBottomSheetProps) {
  const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(0.62);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    return beginFilterDraftSession();
  }, [open]);

  useEffect(() => {
    if (!open || !focusTarget) return;
    setActiveSnapPoint(0.94);
    const frame = window.requestAnimationFrame(() => {
      const section = bodyRef.current?.querySelector<HTMLElement>(
        `[data-filter-section="${focusTarget}"]`,
      );
      if (!section) return;
      section.scrollIntoView({ block: "start", behavior: "smooth" });
      const control = section.querySelector<HTMLElement>("input, select, button, [tabindex]");
      control?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusTarget, open]);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground={false}
      snapPoints={[0.62, 0.94]}
      activeSnapPoint={activeSnapPoint}
      setActiveSnapPoint={setActiveSnapPoint}
      fadeFromIndex={1}
    >
      <BottomSheetContent className="rawaj-filter-sheet" data-filter-state="draft">
        <div className="rawaj-filter-sheet__header">
          <div>
            <BottomSheetTitle>{text("فلترة الإعلانات", "Filter listings")}</BottomSheetTitle>
            <BottomSheetDescription>
              {activeCount > 0
                ? text(`${activeCount} فلاتر نشطة`, `${activeCount} active filters`)
                : text("اختر ما يناسب بحثك", "Choose what fits your search")}
            </BottomSheetDescription>
          </div>
          <div className="rawaj-filter-sheet__header-actions">
            <button
              type="button"
              onClick={() => setActiveSnapPoint(activeSnapPoint === 0.94 ? 0.62 : 0.94)}
              aria-label={
                activeSnapPoint === 0.94
                  ? text("تصغير نافذة الفلاتر", "Collapse filter sheet")
                  : text("توسيع نافذة الفلاتر", "Expand filter sheet")
              }
            >
              <ChevronUp
                aria-hidden="true"
                className={activeSnapPoint === 0.94 ? "rotate-180" : undefined}
              />
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={text("إغلاق الفلاتر", "Close filters")}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </div>

        <div ref={bodyRef} className="rawaj-filter-sheet__body">{children}</div>

        <div className="rawaj-filter-sheet__footer">
          <button type="button" onClick={onReset} disabled={activeCount === 0}>
            {text("مسح الفلاتر", "Clear filters")}
          </button>
          <button type="button" onClick={onApply}>
            {text("تطبيق وعرض النتائج", "Apply and show results")}
          </button>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
`,
);

await replaceOnce(
  "src/lib/category-fields.ts",
  `export const carMakeOptions = [
  "Toyota",
  "Hyundai",
  "Kia",
  "Mercedes-Benz",
  "BMW",
  "Nissan",
  "Honda",
  "Ford",
  "Chevrolet",
  "Renault",
  "Peugeot",
  "Volkswagen",
  "Audi",
  "Mitsubishi",
  "Mazda",
  "Suzuki",
  "Chery",
  "Geely",
  "BYD",
  "Other",
] as const;
`,
  `export const carMakeOptions = [
  "Toyota", "Hyundai", "Kia", "Mercedes-Benz", "BMW", "Nissan", "Honda", "Ford",
  "Chevrolet", "Renault", "Peugeot", "Volkswagen", "Audi", "Mitsubishi", "Mazda",
  "Suzuki", "Lexus", "Infiniti", "GMC", "Cadillac", "Jeep", "Dodge", "Chrysler",
  "Subaru", "Isuzu", "Opel", "Citroen", "Fiat", "Seat", "Skoda", "Volvo",
  "Land Rover", "Porsche", "Tesla", "Mini", "Alfa Romeo", "Chery", "Geely", "BYD",
  "MG", "Haval", "Great Wall", "JAC", "Dongfeng", "BAIC", "FAW", "Lada", "Saipa",
  "Iran Khodro", "Daewoo", "SsangYong", "Other",
] as const;

export const carModelOptionsByMake: Partial<Record<(typeof carMakeOptions)[number], readonly string[]>> = {
  Toyota: ["Corolla", "Camry", "Yaris", "RAV4", "Land Cruiser", "Prado", "Hilux", "Fortuner", "C-HR"],
  Hyundai: ["Accent", "Elantra", "Sonata", "Tucson", "Santa Fe", "i10", "i20", "i30", "Creta"],
  Kia: ["Rio", "Cerato", "Optima", "K5", "Sportage", "Sorento", "Picanto", "Seltos"],
  "Mercedes-Benz": ["A-Class", "C-Class", "E-Class", "S-Class", "GLA", "GLC", "GLE", "Sprinter", "Vito"],
  BMW: ["1 Series", "3 Series", "5 Series", "7 Series", "X1", "X3", "X5", "X6"],
  Nissan: ["Sunny", "Sentra", "Altima", "Maxima", "Qashqai", "X-Trail", "Patrol", "Navara"],
  Honda: ["Civic", "Accord", "City", "CR-V", "HR-V", "Pilot"],
  Ford: ["Focus", "Fusion", "Mondeo", "Escape", "Explorer", "Ranger", "Transit"],
  Chevrolet: ["Aveo", "Cruze", "Malibu", "Captiva", "Tahoe", "Suburban", "Silverado"],
  Renault: ["Logan", "Symbol", "Clio", "Megane", "Duster", "Koleos"],
  Peugeot: ["206", "207", "208", "301", "307", "308", "508", "2008", "3008", "5008"],
  Volkswagen: ["Golf", "Passat", "Jetta", "Polo", "Tiguan", "Touareg", "Caddy"],
  Audi: ["A3", "A4", "A5", "A6", "A7", "A8", "Q3", "Q5", "Q7", "Q8"],
  Mitsubishi: ["Lancer", "Pajero", "Outlander", "ASX", "L200", "Attrage"],
  Mazda: ["Mazda2", "Mazda3", "Mazda6", "CX-3", "CX-5", "CX-9", "BT-50"],
  Suzuki: ["Swift", "Celerio", "Baleno", "Vitara", "Jimny", "Dzire"],
  Chery: ["Arrizo 5", "Arrizo 7", "Tiggo 2", "Tiggo 3", "Tiggo 4", "Tiggo 7", "Tiggo 8"],
  Geely: ["Emgrand", "Coolray", "Azkarra", "Monjaro", "Geometry C"],
  BYD: ["F3", "Qin", "Song", "Tang", "Dolphin", "Atto 3", "Han"],
  Skoda: ["Octavia", "Superb", "Fabia", "Kodiaq", "Karoq"],
  Opel: ["Astra", "Corsa", "Insignia", "Mokka", "Zafira"],
  MG: ["MG 3", "MG 5", "MG 6", "ZS", "HS"],
};

export const electronicsBrandOptions = [
  "Apple", "Samsung", "Xiaomi", "Redmi", "Poco", "Huawei", "Honor", "Oppo", "Realme",
  "OnePlus", "Vivo", "Nokia", "Motorola", "Google", "Sony", "Asus", "Lenovo", "Acer",
  "HP", "Dell", "MSI", "Microsoft", "Tecno", "Infinix", "ZTE", "Nothing",
] as const;
`,
);

await replaceOnce(
  "src/features/listings/listings-components.tsx",
  `import { Link } from "@tanstack/react-router";
import { carMakeOptions, type CategoryFieldKind } from "@/lib/category-fields";`,
  `import { Link } from "@tanstack/react-router";
import { useId } from "react";
import {
  carMakeOptions,
  carModelOptionsByMake,
  electronicsBrandOptions,
  type CategoryFieldKind,
} from "@/lib/category-fields";`,
);
await replaceOnce(
  "src/features/listings/listings-components.tsx",
  `        <FilterInput
          label={text("الطراز", "Model")}
          value={values.carModel}
          onChange={setters.setCarModel}
        />`,
  `        <FilterInput
          label={text("الطراز", "Model")}
          value={values.carModel}
          onChange={setters.setCarModel}
          suggestions={carModelOptionsByMake[values.carMake] ?? []}
          placeholder={text("اكتب أو اختر الطراز", "Type or choose a model")}
        />`,
);
await replaceOnce(
  "src/features/listings/listings-components.tsx",
  `        <FilterInput
          label={text("الشركة", "Brand")}
          value={values.electronicsBrand}
          onChange={setters.setElectronicsBrand}
        />`,
  `        <FilterInput
          label={text("الشركة", "Brand")}
          value={values.electronicsBrand}
          onChange={setters.setElectronicsBrand}
          suggestions={electronicsBrandOptions}
          placeholder={text("اكتب أو اختر الشركة", "Type or choose a brand")}
        />`,
);
await replaceOnce(
  "src/features/listings/listings-components.tsx",
  `export function FilterInput({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        className="input text-xs"
      />
    </label>
  );
}`,
  `export function FilterInput({
  label,
  value,
  onChange,
  inputMode,
  suggestions = [],
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  suggestions?: readonly string[];
  placeholder?: string;
}) {
  const suggestionId = useId();
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        list={suggestions.length > 0 ? suggestionId : undefined}
        placeholder={placeholder}
        className="input text-xs"
      />
      {suggestions.length > 0 ? (
        <datalist id={suggestionId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      ) : null}
    </label>
  );
}`,
);

await replaceOnce(
  "src/routes/listings.index.tsx",
  `import { QuickFilterRail } from "@/features/search/QuickFilterRail";`,
  `import {
  QuickFilterRail,
  type QuickFilterTarget,
} from "@/features/search/QuickFilterRail";`,
);
await replaceOnce(
  "src/routes/listings.index.tsx",
  `  const [filtersOpen, setFiltersOpen] = useState(Boolean(search.open_filters));
  const loadMoreSentinelRef`,
  `  const [filtersOpen, setFiltersOpen] = useState(Boolean(search.open_filters));
  const [filterFocus, setFilterFocus] = useState<QuickFilterTarget | null>(null);
  const loadMoreSentinelRef`,
);
await replaceOnce(
  "src/routes/listings.index.tsx",
  `  function handleFilterSheetOpenChange(nextOpen: boolean) {
    if (!nextOpen) restoreFilterDraftFromSearch();
    setFiltersOpen(nextOpen);
  }
`,
  `  function handleFilterSheetOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      restoreFilterDraftFromSearch();
      setFilterFocus(null);
    }
    setFiltersOpen(nextOpen);
  }

  function openFiltersAt(target: QuickFilterTarget | null = null) {
    setFilterFocus(target);
    setFiltersOpen(true);
  }
`,
);
await replaceOnce(
  "src/routes/listings.index.tsx",
  `          onOpenFilters={() => setFiltersOpen(true)}`,
  `          onOpenFilters={() => openFiltersAt(null)}`,
);
await replaceOnce(
  "src/routes/listings.index.tsx",
  `          onOpenFilters={() => setFiltersOpen(true)}
          onNewest`,
  `          onOpenFilter={openFiltersAt}
          onNewest`,
);
await replaceOnce(
  "src/routes/listings.index.tsx",
  `          onApply={applyFilters}
          text={text}`,
  `          onApply={applyFilters}
          focusTarget={filterFocus}
          text={text}`,
);
await replaceOnce(
  "src/routes/listings.index.tsx",
  `<section className="rawaj-filter-sheet__section">
            <div className="rawaj-filter-sheet__section-heading">
              <h3>{text("القسم", "Category")}</h3>`,
  `<section className="rawaj-filter-sheet__section" data-filter-section="category">
            <div className="rawaj-filter-sheet__section-heading">
              <h3>{text("القسم", "Category")}</h3>`,
);
await replaceOnce(
  "src/routes/listings.index.tsx",
  `<section className="rawaj-filter-sheet__section">
            <div className="rawaj-filter-sheet__section-heading">
              <h3>{text("الموقع", "Location")}</h3>`,
  `<section className="rawaj-filter-sheet__section" data-filter-section="location">
            <div className="rawaj-filter-sheet__section-heading">
              <h3>{text("الموقع", "Location")}</h3>`,
);
await replaceOnce(
  "src/routes/listings.index.tsx",
  `<section className="rawaj-filter-sheet__section">
            <div className="rawaj-filter-sheet__section-heading">
              <h3>{text("السعر", "Price")}</h3>`,
  `<section className="rawaj-filter-sheet__section" data-filter-section="price">
            <div className="rawaj-filter-sheet__section-heading">
              <h3>{text("السعر", "Price")}</h3>`,
);
await replaceOnce(
  "src/routes/listings.index.tsx",
  `{draftCategoryFieldKind !== "general" ? (
            <section className="rawaj-filter-sheet__section">`,
  `{draftCategoryFieldKind !== "general" ? (
            <section
              className="rawaj-filter-sheet__section"
              data-filter-section={draftCategoryFieldKind === "electronics" ? "condition" : "category-options"}
            >`,
);

await writeFile(
  "scripts/listings-filter-actions-and-depth.test.mjs",
  `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [rail, sheet, route, fields, components] = await Promise.all([
  readFile(new URL("../src/features/search/QuickFilterRail.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/search/FilterBottomSheet.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/listings.index.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/category-fields.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/listings-components.tsx", import.meta.url), "utf8"),
]);

test("each quick filter opens its own destination", () => {
  for (const target of ["location", "price", "category", "condition"]) {
    assert.match(rail, new RegExp(`onOpenFilter\\(\\"${target}\\"\\)`));
    assert.match(route, new RegExp(`data-filter-section=.*${target}`));
  }
  assert.match(sheet, /scrollIntoView/);
  assert.match(sheet, /focusTarget/);
  assert.match(route, /onOpenFilter=\{openFiltersAt\}/);
});

test("vehicle and electronics filters keep free text while offering broad suggestions", () => {
  assert.match(fields, /Iran Khodro/);
  assert.match(fields, /Land Rover/);
  assert.match(fields, /carModelOptionsByMake/);
  assert.match(fields, /electronicsBrandOptions/);
  assert.match(components, /<datalist/);
  assert.match(components, /Type or choose a model/);
  assert.match(components, /Type or choose a brand/);
});
`,
);
