from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file_path = Path(path)
    source = file_path.read_text()
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    file_path.write_text(source.replace(old, new, 1))


LISTINGS = "src/lib/api/listings.ts"
DYNAMIC = "src/lib/api/dynamic-filtered-listings.ts"
SYP_API = "src/lib/api/syp-denomination.ts"
CONTRACT = "scripts/syp-denomination-phase-a.test.mjs"

replace_once(
    LISTINGS,
    'import { publicListingDetailAliases, publicListingSelect } from "@/lib/api/public-fields";',
    'import {\n'
    '  publicListingDetailAliases,\n'
    '  publicListingSelectForSchema,\n'
    '} from "@/lib/api/public-fields";\n'
    'import { supportsSypDenominationSchema } from "@/lib/api/syp-denomination-schema";',
    "listing schema-aware imports",
)

replace_once(
    LISTINGS,
    "  filters = await hydrateSavedTaxonomyFilter(clientResult.data, filters);\n\n"
    "  if (hasDynamicListingFilters(filters)) {",
    "  const supportsSypDenomination = await supportsSypDenominationSchema(clientResult.data);\n\n"
    "  filters = await hydrateSavedTaxonomyFilter(clientResult.data, filters);\n\n"
    "  if (hasDynamicListingFilters(filters)) {",
    "public listing schema probe",
)

replace_once(
    LISTINGS,
    "  const listingSelect = filters.withPhotos\n"
    "    ? `${publicListingSelect},listing_images!inner(id)`\n"
    "    : publicListingSelect;",
    "  const schemaListingSelect = publicListingSelectForSchema(supportsSypDenomination);\n"
    "  const listingSelect = filters.withPhotos\n"
    "    ? `${schemaListingSelect},listing_images!inner(id)`\n"
    "    : schemaListingSelect;",
    "public listing select fallback",
)

replace_once(
    LISTINGS,
    '  if (filters.priceMin !== undefined) {\n'
    '    query = query.gte("price_new_syp_normalized", filters.priceMin);\n'
    '  }\n'
    '  if (filters.priceMax !== undefined) {\n'
    '    query = query.lte("price_new_syp_normalized", filters.priceMax);\n'
    '  }',
    '  if (filters.priceMin !== undefined) {\n'
    '    query = supportsSypDenomination\n'
    '      ? query.gte("price_new_syp_normalized", filters.priceMin)\n'
    '      : query.gte("price", filters.priceMin);\n'
    '  }\n'
    '  if (filters.priceMax !== undefined) {\n'
    '    query = supportsSypDenomination\n'
    '      ? query.lte("price_new_syp_normalized", filters.priceMax)\n'
    '      : query.lte("price", filters.priceMax);\n'
    '  }',
    "public price filter fallback",
)

replace_once(
    LISTINGS,
    '  if (sort === "cheapest") {\n'
    '    query = query\n'
    '      .order("price_new_syp_normalized", { ascending: true, nullsFirst: false })\n'
    '      .order("id", { ascending: true });\n'
    '  } else if (sort === "expensive") {\n'
    '    query = query\n'
    '      .order("price_new_syp_normalized", { ascending: false, nullsFirst: false })\n'
    '      .order("id", { ascending: true });',
    '  if (sort === "cheapest") {\n'
    '    query = supportsSypDenomination\n'
    '      ? query\n'
    '          .order("price_new_syp_normalized", { ascending: true, nullsFirst: false })\n'
    '          .order("id", { ascending: true })\n'
    '      : query.order("price", { ascending: true, nullsFirst: false }).order("id", { ascending: true });\n'
    '  } else if (sort === "expensive") {\n'
    '    query = supportsSypDenomination\n'
    '      ? query\n'
    '          .order("price_new_syp_normalized", { ascending: false, nullsFirst: false })\n'
    '          .order("id", { ascending: true })\n'
    '      : query\n'
    '          .order("price", { ascending: false, nullsFirst: false })\n'
    '          .order("id", { ascending: true });',
    "public price order fallback",
)

replace_once(
    LISTINGS,
    '        query = query.or(`and(price.is.null,id.gt.${id})`);\n'
    '      } else {\n'
    '        const price = escapePostgrestFilterValue(String(cursor.price));\n'
    '        const operator = cursor.type === "cheapest" ? "gt" : "lt";\n'
    '        query = query.or(\n'
    '          `price.${operator}.${price},price.is.null,and(price.eq.${price},id.gt.${id})`,\n'
    '        );',
    '        const priceColumn = supportsSypDenomination ? "price_new_syp_normalized" : "price";\n'
    '        query = query.or(`and(${priceColumn}.is.null,id.gt.${id})`);\n'
    '      } else {\n'
    '        const price = escapePostgrestFilterValue(String(cursor.price));\n'
    '        const operator = cursor.type === "cheapest" ? "gt" : "lt";\n'
    '        const priceColumn = supportsSypDenomination ? "price_new_syp_normalized" : "price";\n'
    '        query = query.or(\n'
    '          `${priceColumn}.${operator}.${price},${priceColumn}.is.null,and(${priceColumn}.eq.${price},id.gt.${id})`,\n'
    '        );',
    "public price cursor fallback",
)

replace_once(
    LISTINGS,
    "            ? { price: listings[safePageSize - 1].priceNewSypNormalized }",
    "            ? {\n"
    "                price: supportsSypDenomination\n"
    "                  ? listings[safePageSize - 1].priceNewSypNormalized\n"
    "                  : listings[safePageSize - 1].price,\n"
    "              }",
    "public next cursor fallback",
)

replace_once(
    LISTINGS,
    "  const { data, error } = await clientResult.data\n"
    '    .from("listings")\n'
    "    .select(publicListingSelect)\n"
    "    .eq(\"id\", listingId)",
    "  const supportsSypDenomination = await supportsSypDenominationSchema(clientResult.data);\n\n"
    "  const { data, error } = await clientResult.data\n"
    '    .from("listings")\n'
    "    .select(publicListingSelectForSchema(supportsSypDenomination))\n"
    "    .eq(\"id\", listingId)",
    "public detail select fallback",
)

replace_once(
    DYNAMIC,
    'import { publicListingSelect } from "@/lib/api/public-fields";',
    'import { publicListingSelectForSchema } from "@/lib/api/public-fields";\n'
    'import { supportsSypDenominationSchema } from "@/lib/api/syp-denomination-schema";',
    "dynamic schema-aware imports",
)

replace_once(
    DYNAMIC,
    "  const { data, error } = await client\n"
    '    .from("listings")\n'
    "    .select(publicListingSelect)",
    "  const supportsSypDenomination = await supportsSypDenominationSchema(client);\n"
    "  const { data, error } = await client\n"
    '    .from("listings")\n'
    "    .select(publicListingSelectForSchema(supportsSypDenomination))",
    "dynamic hydration select fallback",
)

replace_once(
    SYP_API,
    'import { getClient, mapError } from "@/lib/api/shared";',
    'import { getClient, mapError } from "@/lib/api/shared";\n'
    'import { supportsSypDenominationSchema } from "@/lib/api/syp-denomination-schema";',
    "SYP API schema import",
)

replace_once(
    SYP_API,
    "  if (!clientResult.ok) return clientResult;\n\n"
    '  const { data, error } = await clientResult.data.rpc("rawaj_list_unclassified_syp_prices");',
    "  if (!clientResult.ok) return clientResult;\n"
    "  if (!(await supportsSypDenominationSchema(clientResult.data))) {\n"
    "    return { ok: true, data: [] };\n"
    "  }\n\n"
    '  const { data, error } = await clientResult.data.rpc("rawaj_list_unclassified_syp_prices");',
    "queue legacy schema fallback",
)

replace_once(
    SYP_API,
    "  if (!clientResult.ok) return clientResult;\n\n"
    '  const { data, error } = await clientResult.data.rpc("rawaj_classify_syp_listing_price", {',
    "  if (!clientResult.ok) return clientResult;\n"
    "  if (!(await supportsSypDenominationSchema(clientResult.data))) {\n"
    "    return {\n"
    "      ok: false,\n"
    "      error: {\n"
    '        code: "schema_missing",\n'
    '        message: "تصنيف وحدة السعر غير متاح قبل تطبيق Migration الخاصة بالمرحلة A.",\n'
    '        operation: "syp_denomination_classify",\n'
    "      },\n"
    "    };\n"
    "  }\n\n"
    '  const { data, error } = await clientResult.data.rpc("rawaj_classify_syp_listing_price", {',
    "classification legacy schema guard",
)

contract_path = Path(CONTRACT)
contract = contract_path.read_text()
if "Phase A public reads remain compatible before the additive migration" in contract:
    raise RuntimeError("schema compatibility contract already exists")
contract += r'''

test("Phase A public reads remain compatible before the additive migration", async () => {
  const schema = await readPhaseAText("src/lib/api/syp-denomination-schema.ts");
  const fields = await readPhaseAText("src/lib/api/public-fields.ts");
  const listings = await readPhaseAText("src/lib/api/listings.ts");
  const dynamic = await readPhaseAText("src/lib/api/dynamic-filtered-listings.ts");
  const denominationApi = await readPhaseAText("src/lib/api/syp-denomination.ts");

  assert.match(schema, /select\("price_denomination"\)\.limit\(0\)/);
  assert.match(fields, /publicListingLegacySelect/);
  assert.match(fields, /publicListingSelectForSchema/);
  assert.match(listings, /supportsSypDenominationSchema/);
  assert.match(listings, /query\.gte\("price", filters\.priceMin\)/);
  assert.match(listings, /query\.order\("price", \{ ascending: true/);
  assert.match(dynamic, /publicListingSelectForSchema\(supportsSypDenomination\)/);
  assert.match(denominationApi, /return \{ ok: true, data: \[\] \}/);
});
'''
contract_path.write_text(contract)

print("Applied legacy/Phase A schema compatibility for public reads.")
