from pathlib import Path
import re

path = Path("src/routes/listings.index.tsx")
source = path.read_text(encoding="utf-8")

if 'data-dynamic-listing-facets="all-categories"' in source:
    print("Dynamic facets UI integration already present.")
    raise SystemExit(0)


def replace_once(label: str, old: str, new: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    source = source.replace(old, new, 1)


def replace_pattern_once(label: str, pattern: str, replacement) -> None:
    global source
    compiled = re.compile(pattern, re.S)
    matches = list(compiled.finditer(source))
    if len(matches) != 1:
        raise SystemExit(f"{label}: expected one match, found {len(matches)}")
    source = compiled.sub(replacement, source, count=1)


replace_once(
    "facet imports",
    'import { NearbyDiscoveryControl } from "@/features/listings/NearbyDiscoveryControl";\n',
    'import { DynamicListingFacetFilters } from "@/features/listings/DynamicListingFacetFilters";\n'
    'import { NearbyDiscoveryControl } from "@/features/listings/NearbyDiscoveryControl";\n',
)
replace_once(
    "facet state imports",
    'import { useListingsPagination } from "@/features/listings/use-listings-pagination";\n',
    'import { useListingsPagination } from "@/features/listings/use-listings-pagination";\n'
    'import { useListingFacets } from "@/features/listings/use-listing-facets";\n'
    'import {\n'
    '  countListingAttributeFilters,\n'
    '  encodeListingAttributeFilters,\n'
    '  parseListingAttributeFilters,\n'
    '} from "@/features/listings/listing-attribute-filter-state";\n',
)
replace_once(
    "attribute state",
    '  const [salaryType, setSalaryType] = useState(search.salary_type ?? "");\n'
    '  const [q, setQ] = useState(search.q ?? "");\n',
    '  const [salaryType, setSalaryType] = useState(search.salary_type ?? "");\n'
    '  const [attributeFilters, setAttributeFilters] = useState(() =>\n'
    '    parseListingAttributeFilters(search.attrs),\n'
    '  );\n'
    '  const [q, setQ] = useState(search.q ?? "");\n',
)
replace_once(
    "facet hook",
    '  const hasPriceContradiction =\n'
    '    typeof parsedPriceMin === "number" &&\n'
    '    typeof parsedPriceMax === "number" &&\n'
    '    parsedPriceMin > parsedPriceMax;\n'
    '  const hasActiveFilters = Boolean(\n',
    '  const hasPriceContradiction =\n'
    '    typeof parsedPriceMin === "number" &&\n'
    '    typeof parsedPriceMax === "number" &&\n'
    '    parsedPriceMin > parsedPriceMax;\n'
    '  const encodedAttributeFilters = useMemo(\n'
    '    () => encodeListingAttributeFilters(attributeFilters),\n'
    '    [attributeFilters],\n'
    '  );\n'
    '  const dynamicFacetCount = countListingAttributeFilters(attributeFilters);\n'
    '  const listingFacets = useListingFacets({\n'
    '    enabled: Boolean(taxonomyFilterScope?.taxonomyNodeIds.length),\n'
    '    taxonomyNodeIds: taxonomyFilterScope?.taxonomyNodeIds,\n'
    '    attributeFilters,\n'
    '    governorateId: govId || undefined,\n'
    '    priceMin: parsedPriceMin,\n'
    '    priceMax: parsedPriceMax,\n'
    '    query: debouncedQ,\n'
    '  });\n'
    '  const hasActiveFilters = Boolean(\n',
)
replace_once(
    "active filter count",
    '    salaryType ||\n    withPhotos,\n',
    '    salaryType ||\n    withPhotos ||\n    dynamicFacetCount > 0,\n',
)
replace_once(
    "sync attribute state",
    '    setSalaryType(search.salary_type ?? "");\n'
    '    setSort(search.sort ?? "latest");\n',
    '    setSalaryType(search.salary_type ?? "");\n'
    '    setAttributeFilters(parseListingAttributeFilters(search.attrs));\n'
    '    setSort(search.sort ?? "latest");\n',
)
replace_once(
    "sync attribute dependency",
    '    search.car_make,\n',
    '    search.attrs,\n    search.car_make,\n',
)

replace_pattern_once(
    "sync URL attrs",
    r'      search: buildListingsSyncSearch\(\{(?P<body>.*?)\n      \}\),\n      replace: true,',
    lambda match: (
        '      search: {\n'
        '        ...buildListingsSyncSearch({' + match.group('body') + '\n        }),\n'
        '        attrs: encodedAttributeFilters,\n'
        '      },\n'
        '      replace: true,'
    ),
)
replace_once(
    "sync attrs dependency",
    '    view,\n    filtersOpen,\n',
    '    view,\n    encodedAttributeFilters,\n    filtersOpen,\n',
)
replace_once(
    "results attrs",
    '    debouncedQ,\n    sort,\n    referencesLoaded,\n',
    '    debouncedQ,\n    sort,\n    attributeFilters,\n    referencesLoaded,\n',
)
replace_once(
    "results total",
    '    nextCursor,\n    filterVersionRef,\n',
    '    nextCursor,\n    totalCount,\n    filterVersionRef,\n',
)
replace_once(
    "dynamic active filters",
    '  const activeFilterCount = activeFilters.length;\n',
    '  const dynamicActiveFilters = Object.entries(attributeFilters).map(([fieldKey, value]) => {\n'
    '    const facet = listingFacets.data.facets.find((item) => item.fieldKey === fieldKey);\n'
    '    const fieldLabel = facet\n'
    '      ? language === "en"\n'
    '        ? facet.labelEn || facet.labelAr\n'
    '        : facet.labelAr\n'
    '      : fieldKey;\n'
    '    return {\n'
    '      key: `attribute:${fieldKey}`,\n'
    '      label: `${fieldLabel}: ${formatDynamicFilterValue(value, facet, language, text)}`,\n'
    '      clear: () =>\n'
    '        setAttributeFilters((current) => {\n'
    '          const next = { ...current };\n'
    '          delete next[fieldKey];\n'
    '          return next;\n'
    '        }),\n'
    '    };\n'
    '  });\n'
    '  const allActiveFilters = [...activeFilters, ...dynamicActiveFilters];\n'
    '  const activeFilterCount = allActiveFilters.length;\n',
)
replace_once(
    "pagination attrs",
    '    debouncedQ,\n    sort,\n    nextCursor,\n',
    '    debouncedQ,\n    sort,\n    attributeFilters,\n    nextCursor,\n',
)
replace_once(
    "restore attrs",
    '    setSalaryType(search.salary_type ?? "");\n'
    '    setSubcategoryId(search.subcategory ?? "");\n',
    '    setSalaryType(search.salary_type ?? "");\n'
    '    setAttributeFilters(parseListingAttributeFilters(search.attrs));\n'
    '    setSubcategoryId(search.subcategory ?? "");\n',
)
replace_once(
    "reset attrs",
    '    setSalaryType("");\n'
    '    setQ("");\n',
    '    setSalaryType("");\n'
    '    setAttributeFilters({});\n'
    '    setQ("");\n',
)
replace_pattern_once(
    "mobile apply attrs",
    r'      search: buildListingsMobileApplySearch\(\{(?P<body>.*?)\n      \}\),\n      replace: true,',
    lambda match: (
        '      search: {\n'
        '        ...buildListingsMobileApplySearch({' + match.group('body') + '\n        }),\n'
        '        attrs: encodedAttributeFilters,\n'
        '      },\n'
        '      replace: true,'
    ),
)
replace_once(
    "exact result count",
    '          resultCount={visibleItems.length}\n',
    '          resultCount={nearby.active ? nearby.items.length : (totalCount ?? visibleItems.length)}\n',
)
replace_once(
    "saved search attrs",
    '            salary_type: salaryType,\n            sort,\n',
    '            salary_type: salaryType,\n            attrs: encodedAttributeFilters ?? "",\n            sort,\n',
)
replace_once(
    "desktop facets",
    '                  taxonomyOwnsType={taxonomyOwnsPropertyType}\n'
    '                />\n'
    '                <div className="mt-3 flex justify-end">\n',
    '                  taxonomyOwnsType={taxonomyOwnsPropertyType}\n'
    '                />\n'
    '                <div className="mt-4">\n'
    '                  <DynamicListingFacetFilters\n'
    '                    facets={listingFacets.data.facets}\n'
    '                    values={attributeFilters}\n'
    '                    loading={listingFacets.loading}\n'
    '                    errorMessage={listingFacets.error?.message}\n'
    '                    language={language}\n'
    '                    onChange={setAttributeFilters}\n'
    '                    text={text}\n'
    '                  />\n'
    '                </div>\n'
    '                <div className="mt-3 flex justify-end">\n',
)
replace_once(
    "mobile facets",
    '          ) : null}\n'
    '        </FilterBottomSheet>\n',
    '          ) : null}\n\n'
    '          {listingFacets.data.facets.length > 0 ? (\n'
    '            <section className="rawaj-filter-sheet__section">\n'
    '              <div className="rawaj-filter-sheet__section-heading">\n'
    '                <h3>{text("تفاصيل القسم", "Category details")}</h3>\n'
    '              </div>\n'
    '              <DynamicListingFacetFilters\n'
    '                facets={listingFacets.data.facets}\n'
    '                values={attributeFilters}\n'
    '                loading={listingFacets.loading}\n'
    '                errorMessage={listingFacets.error?.message}\n'
    '                language={language}\n'
    '                onChange={setAttributeFilters}\n'
    '                text={text}\n'
    '              />\n'
    '            </section>\n'
    '          ) : null}\n'
    '        </FilterBottomSheet>\n',
)
replace_once(
    "loaded result count",
    '                   `${visibleItems.length} نتيجة محملة حاليًا`,\n'
    '                   `${visibleItems.length} currently loaded results`,\n',
    '                   totalCount === null\n'
    '                     ? `${visibleItems.length} نتيجة محملة حاليًا`\n'
    '                     : `${totalCount} نتيجة، تم تحميل ${visibleItems.length}`,\n'
    '                   totalCount === null\n'
    '                     ? `${visibleItems.length} currently loaded results`\n'
    '                     : `${totalCount} results, ${visibleItems.length} loaded`,\n',
)
replace_once(
    "all active chips",
    '          {activeFilters.map((filter) => (\n',
    '          {allActiveFilters.map((filter) => (\n',
)

source += '''\n\nfunction formatDynamicFilterValue(\n  value: string | boolean | string[] | { min?: number; max?: number },\n  facet: { options: Array<{ valueKey: string; labelAr: string; labelEn: string | null }> } | undefined,\n  language: "ar" | "en",\n  text: (ar: string, en: string) => string,\n) {\n  if (typeof value === "boolean") return value ? text("نعم", "Yes") : text("لا", "No");\n  if (Array.isArray(value)) {\n    return value\n      .map((item) => dynamicOptionLabel(item, facet, language))\n      .join(language === "ar" ? "، " : ", ");\n  }\n  if (value && typeof value === "object") {\n    const minimum = value.min === undefined ? "…" : String(value.min);\n    const maximum = value.max === undefined ? "…" : String(value.max);\n    return `${minimum} – ${maximum}`;\n  }\n  return dynamicOptionLabel(value, facet, language);\n}\n\nfunction dynamicOptionLabel(\n  value: string,\n  facet: { options: Array<{ valueKey: string; labelAr: string; labelEn: string | null }> } | undefined,\n  language: "ar" | "en",\n) {\n  const option = facet?.options.find((item) => item.valueKey === value);\n  if (!option) return value;\n  return language === "en" ? option.labelEn || option.labelAr : option.labelAr;\n}\n'''

path.write_text(source, encoding="utf-8")
print("Dynamic facets UI integration completed.")
