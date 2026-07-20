import type { ListingFacet, ListingFacetFilterValue } from "@/lib/api/listing-facets";
import type { Language } from "@/lib/ui-preferences";
import type { ListingAttributeFilters } from "@/features/listings/listing-attribute-filter-state";

interface DynamicListingFacetFiltersProps {
  facets: ListingFacet[];
  values: ListingAttributeFilters;
  loading: boolean;
  errorMessage?: string | null;
  language: Language;
  onChange: (values: ListingAttributeFilters) => void;
  text: (ar: string, en: string) => string;
}

export function DynamicListingFacetFilters({
  facets,
  values,
  loading,
  errorMessage,
  language,
  onChange,
  text,
}: DynamicListingFacetFiltersProps) {
  if (loading && facets.length === 0) {
    return (
      <div
        className="grid gap-3"
        aria-label={text("جارٍ تحميل فلاتر القسم", "Loading category filters")}
      >
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-muted-surface" />
        ))}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <p className="rounded-xl bg-muted-surface p-3 text-xs text-muted-foreground">
        {text(
          "تعذر تحميل خيارات القسم الآن، ويمكنك متابعة البحث بالفلاتر الأساسية.",
          "Category filters are temporarily unavailable. Basic filters remain available.",
        )}
      </p>
    );
  }

  if (facets.length === 0) return null;

  return (
    <div className="grid gap-4" data-dynamic-listing-facets="all-categories">
      {facets.map((facet) => (
        <FacetField
          key={facet.fieldKey}
          facet={facet}
          value={values[facet.fieldKey]}
          language={language}
          onChange={(value) => updateFacetValue(values, facet.fieldKey, value, onChange)}
          text={text}
        />
      ))}
    </div>
  );
}

interface FacetFieldProps {
  facet: ListingFacet;
  value: ListingFacetFilterValue | undefined;
  language: Language;
  onChange: (value: ListingFacetFilterValue | undefined) => void;
  text: (ar: string, en: string) => string;
}

function FacetField({ facet, value, language, onChange, text }: FacetFieldProps) {
  const label = language === "en" ? facet.labelEn || facet.labelAr : facet.labelAr;
  const isNumeric = ["integer", "numeric", "year"].includes(facet.fieldType);

  if (isNumeric) {
    const range = isRange(value) ? value : {};
    return (
      <fieldset className="rounded-xl bg-muted-surface p-3">
        <legend className="px-1 text-xs font-extrabold text-foreground">{label}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label>
            <span className="mb-1 block text-[11px] font-bold text-muted-foreground">
              {text("من", "From")}
            </span>
            <input
              value={range.min ?? ""}
              onChange={(event) =>
                onChange(buildRange(event.target.value, range.max, facet.minimum, facet.maximum))
              }
              type="number"
              inputMode="decimal"
              min={facet.minimum ?? undefined}
              max={facet.maximum ?? undefined}
              placeholder={facet.minimum?.toString()}
              className="input text-xs"
            />
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-bold text-muted-foreground">
              {text("إلى", "To")}
            </span>
            <input
              value={range.max ?? ""}
              onChange={(event) =>
                onChange(buildRange(range.min, event.target.value, facet.minimum, facet.maximum))
              }
              type="number"
              inputMode="decimal"
              min={facet.minimum ?? undefined}
              max={facet.maximum ?? undefined}
              placeholder={facet.maximum?.toString()}
              className="input text-xs"
            />
          </label>
        </div>
      </fieldset>
    );
  }

  if (facet.options.length === 0) return null;
  const isMulti = facet.fieldType === "multi_select";
  const selectedValues = isMulti
    ? Array.isArray(value)
      ? value
      : []
    : value === undefined
      ? []
      : [String(value)];

  return (
    <fieldset className="rounded-xl bg-muted-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <legend className="px-1 text-xs font-extrabold text-foreground">{label}</legend>
        {selectedValues.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-[11px] font-bold text-primary"
          >
            {text("مسح", "Clear")}
          </button>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {facet.options.map((option) => {
          const selected = selectedValues.includes(option.valueKey);
          const optionLabel = language === "en" ? option.labelEn || option.labelAr : option.labelAr;
          return (
            <button
              key={option.valueKey}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                if (isMulti) {
                  const next = selected
                    ? selectedValues.filter((item) => item !== option.valueKey)
                    : [...selectedValues, option.valueKey];
                  onChange(next.length > 0 ? next : undefined);
                  return;
                }
                if (facet.fieldType === "boolean") {
                  onChange(selected ? undefined : option.valueKey === "true");
                  return;
                }
                onChange(selected ? undefined : option.valueKey);
              }}
              className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-start text-xs font-bold transition ${
                selected
                  ? "bg-gold text-gold-foreground"
                  : "bg-card text-foreground hairline hover:bg-secondary"
              }`}
            >
              <span className="min-w-0 truncate">{optionLabel}</span>
              <b className="shrink-0 text-[10px] opacity-70">{option.count}</b>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function updateFacetValue(
  current: ListingAttributeFilters,
  fieldKey: string,
  value: ListingFacetFilterValue | undefined,
  onChange: (values: ListingAttributeFilters) => void,
) {
  const next = { ...current };
  if (value === undefined || (Array.isArray(value) && value.length === 0)) {
    delete next[fieldKey];
  } else {
    next[fieldKey] = value;
  }
  onChange(next);
}

function isRange(
  value: ListingFacetFilterValue | undefined,
): value is { min?: number; max?: number } {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function buildRange(
  minimumValue: string | number | undefined,
  maximumValue: string | number | undefined,
  allowedMinimum: number | null,
  allowedMaximum: number | null,
): { min?: number; max?: number } | undefined {
  const minimum = parseNumber(minimumValue, allowedMinimum, allowedMaximum);
  const maximum = parseNumber(maximumValue, allowedMinimum, allowedMaximum);
  if (minimum === undefined && maximum === undefined) return undefined;
  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    return { min: maximum, max: minimum };
  }
  return {
    ...(minimum !== undefined ? { min: minimum } : {}),
    ...(maximum !== undefined ? { max: maximum } : {}),
  };
}

function parseNumber(
  value: string | number | undefined,
  allowedMinimum: number | null,
  allowedMaximum: number | null,
): number | undefined {
  if (value === "" || value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (allowedMinimum !== null && parsed < allowedMinimum) return allowedMinimum;
  if (allowedMaximum !== null && parsed > allowedMaximum) return allowedMaximum;
  return parsed;
}
