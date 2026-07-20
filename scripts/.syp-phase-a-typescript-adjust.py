from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    source = path.read_text()
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    path.write_text(source.replace(old, new, 1))


reports = Path("src/lib/api/reports.ts")
replace_once(
    reports,
    '    currency: "SYP",\n    priceType:',
    '    currency: "SYP",\n'
    '    priceDenomination: rowString(\n'
    '      row,\n'
    '      "price_denomination",\n'
    '      "unclassified",\n'
    '    ) as ClassifiedListing["priceDenomination"],\n'
    '    priceNewSypNormalized: rowNullableString(row, "price_new_syp_normalized")\n'
    '      ? Number(rowNullableString(row, "price_new_syp_normalized"))\n'
    '      : null,\n'
    '    priceType:',
    "reports listing denomination mapping",
)

api = Path("src/lib/api/syp-denomination.ts")
replace_once(
    api,
    'import { getClient, mapError, rowArray } from "@/lib/api/shared";',
    'import { getClient, mapError } from "@/lib/api/shared";',
    "remove field-array helper import",
)
replace_once(
    api,
    '    data: rowArray(data).map((row) => mapListing(row)),',
    '    data: (Array.isArray(data) ? (data as Record<string, unknown>[]) : []).map((row) =>\n'
    '      mapListing(row),\n'
    '    ),',
    "queue RPC row mapping",
)
replace_once(
    api,
    '  const row = rowArray(data)[0];',
    '  const row = Array.isArray(data)\n'
    '    ? (data[0] as Record<string, unknown> | undefined)\n'
    '    : undefined;',
    "classification RPC row mapping",
)

print("Adjusted Phase A TypeScript integration points.")
