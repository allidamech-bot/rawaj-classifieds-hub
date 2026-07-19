from pathlib import Path


def replace_once(path: Path, label: str, old: str, new: str) -> None:
    source = path.read_text(encoding="utf-8")
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{path}: {label} marker count {count}")
    path.write_text(source.replace(old, new, 1), encoding="utf-8")


filters_path = Path("src/features/listings/listings-filters.ts")
filters_source = filters_path.read_text(encoding="utf-8")
if "ListingAttributeFilters" not in filters_source:
    replace_once(
        filters_path,
        "attribute filter import",
        'import type { CategoryFieldKind } from "@/lib/category-fields";\n',
        'import type { CategoryFieldKind } from "@/lib/category-fields";\n'
        'import type { ListingAttributeFilters } from "@/features/listings/listing-attribute-filter-state";\n',
    )
    replace_once(
        filters_path,
        "filter input property",
        '  sort: ListingsSort;\n}\n\nexport interface ListingsUrlSearch',
        '  sort: ListingsSort;\n'
        '  attributeFilters?: ListingAttributeFilters;\n'
        '}\n\nexport interface ListingsUrlSearch',
    )
    replace_once(
        filters_path,
        "filter destructure",
        '    debouncedQ,\n    sort,\n  } = inputs;\n',
        '    debouncedQ,\n    sort,\n    attributeFilters,\n  } = inputs;\n',
    )
    replace_once(
        filters_path,
        "filter result",
        '    query: debouncedQ,\n    sort,\n  };\n}\n',
        '    query: debouncedQ,\n'
        '    sort,\n'
        '    attributeFilters:\n'
        '      attributeFilters && Object.keys(attributeFilters).length > 0\n'
        '        ? attributeFilters\n'
        '        : undefined,\n'
        '  };\n}\n',
    )

results_path = Path("src/features/listings/use-listings-results.ts")
results_source = results_path.read_text(encoding="utf-8")
if "filterInputs.attributeFilters" not in results_source:
    replace_once(
        results_path,
        "results dependency",
        '    filterInputs.sort,\n  ]);\n',
        '    filterInputs.sort,\n    filterInputs.attributeFilters,\n  ]);\n',
    )

pagination_path = Path("src/features/listings/use-listings-pagination.ts")
pagination_source = pagination_path.read_text(encoding="utf-8")
if "attributeFilters" not in pagination_source:
    replace_once(
        pagination_path,
        "pagination destructure",
        '    debouncedQ,\n    sort,\n  } = inputs;\n',
        '    debouncedQ,\n    sort,\n    attributeFilters,\n  } = inputs;\n',
    )
    replace_once(
        pagination_path,
        "pagination filters",
        '        debouncedQ,\n        sort,\n      }),\n',
        '        debouncedQ,\n        sort,\n        attributeFilters,\n      }),\n',
    )
    replace_once(
        pagination_path,
        "pagination dependency",
        '    debouncedQ,\n    sort,\n  ]);\n',
        '    debouncedQ,\n    sort,\n    attributeFilters,\n  ]);\n',
    )

page_data_path = Path("src/features/listings/public-listings-page-data.ts")
page_data_source = page_data_path.read_text(encoding="utf-8")
if "parseListingAttributeFilters" not in page_data_source:
    replace_once(
        page_data_path,
        "page data import",
        'import { buildListingFilters } from "@/features/listings/listings-filters";\n',
        'import { buildListingFilters } from "@/features/listings/listings-filters";\n'
        'import { parseListingAttributeFilters } from "@/features/listings/listing-attribute-filter-state";\n',
    )
    replace_once(
        page_data_path,
        "page data filter",
        '    sort: search.sort ?? "latest",\n  });\n',
        '    sort: search.sort ?? "latest",\n'
        '    attributeFilters: parseListingAttributeFilters(search.attrs),\n'
        '  });\n',
    )

print("Dynamic listing filter pipeline integrated.")
