from __future__ import annotations

import subprocess
from pathlib import Path

PATCH_PATH = Path("/tmp/apply-syp-phase-a.mjs")
ADD_LISTING_PATH = Path("src/routes/add-listing.tsx")


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return source.replace(old, new, 1)


def prepare_patch_script() -> None:
    source = PATCH_PATH.read_text()
    replacements = [
        (
            'replaceExact("src/lib/api/listings.ts", "              ? { price: listings[safePageSize - 1].price }", "              ? { price: listings[safePageSize - 1].priceNewSypNormalized }", 1);',
            'replaceExact("src/lib/api/listings.ts", "? { price: listings[safePageSize - 1].price }", "? { price: listings[safePageSize - 1].priceNewSypNormalized }", 1);',
            "cursor",
        ),
        (
            'replaceExact("src/lib/api/listing-write-rpc.ts", "  if (payload.price !== undefined) patch.price = payload.price;\\n  if (payload.priceType !== undefined) patch.price_type = payload.priceType;", "  if (payload.price !== undefined) patch.price = payload.price;\\n  if (payload.priceDenomination !== undefined) {\\n    patch.price_denomination = payload.priceDenomination;\\n  }\\n  if (payload.priceType !== undefined) patch.price_type = payload.priceType;", 1);',
            'replaceExact("src/lib/api/listing-write-rpc.ts", "  if (payload.price !== undefined) patch.price = payload.price;\\n  if (payload.priceType) patch.price_type = payload.priceType;", "  if (payload.price !== undefined) patch.price = payload.price;\\n  if (payload.priceDenomination !== undefined) {\\n    patch.price_denomination = payload.priceDenomination;\\n  }\\n  if (payload.priceType) patch.price_type = payload.priceType;", 1);',
            "listing-write",
        ),
        (
            'replaceExact("src/lib/classifieds-api.ts", "export * from \\\"@/lib/api/listing-write-rpc\\\";", "export * from \\\"@/lib/api/listing-write-rpc\\\";\\nexport * from \\\"@/lib/api/syp-denomination\\\";", 1);',
            'replaceExact("src/lib/classifieds-api.ts", "export * from \\\"@/lib/api/listings\\\";", "export * from \\\"@/lib/api/listings\\\";\\nexport * from \\\"@/lib/api/syp-denomination\\\";", 1);',
            "classifieds-export",
        ),
    ]
    for old, new, label in replacements:
        source = replace_once(source, old, new, f"patch-script {label}")

    assertion_old = (
        '  if (occurrences !== expected) throw new Error(`${path}: expected ${expected} exact matches, found ${occurrences}`);'
    )
    assertion_new = '''  if (occurrences !== expected) {
    globalThis.__phaseAMismatches ??= [];
    globalThis.__phaseAMismatches.push({ path, expected, occurrences, oldText });
    console.error(`MISMATCH ${path}: expected ${expected} exact matches, found ${occurrences}`);
    return;
  }'''
    source = replace_once(source, assertion_old, assertion_new, "patch-script assertion collector")
    source += '''
const mismatches = globalThis.__phaseAMismatches ?? [];
if (mismatches.length !== 4 || mismatches.some((item) => item.path !== "src/routes/add-listing.tsx")) {
  console.error("Unexpected Phase A anchor mismatches", mismatches);
  process.exit(2);
}
'''
    PATCH_PATH.write_text(source)


def integrate_add_listing() -> None:
    source = ADD_LISTING_PATH.read_text()
    source = replace_once(
        source,
        "      normalizedPrice,\n      priceType,",
        "      normalizedPrice,\n      priceDenomination,\n      priceType,",
        "price denomination dependency",
    )

    marker = '<Field label={text("نوع السعر", "Price type")}>'
    if source.count(marker) != 1:
        raise RuntimeError(f"price type field: expected one marker, found {source.count(marker)}")
    start = source.index(marker)
    line_start = source.rfind("\n", 0, start) + 1
    indent = source[line_start:start]
    end = source.index("</Field>", start) + len("</Field>")
    denomination_field = f'''\n{indent}{{(priceType === "fixed" || priceType === "negotiable") && price ? (
{indent}  <Field
{indent}    label={{text("وحدة الليرة السورية", "Syrian pound denomination")}}
{indent}    error={{fieldErrors.priceDenomination}}
{indent}  >
{indent}    <select
{indent}      value={{priceDenomination}}
{indent}      onChange={{(event) =>
{indent}        setPriceDenomination(event.target.value as SypPriceDenomination)
{indent}      }}
{indent}      className="input"
{indent}      data-first-invalid={{Boolean(fieldErrors.priceDenomination)}}
{indent}    >
{indent}      <option value="unclassified">
{indent}        {{text("اختر القديمة أو الجديدة", "Choose old or new")}}
{indent}      </option>
{indent}      <option value="old">
{indent}        {{text("ليرة سورية قديمة", "Old Syrian pounds")}}
{indent}      </option>
{indent}      <option value="new">
{indent}        {{text("ليرة سورية جديدة", "New Syrian pounds")}}
{indent}      </option>
{indent}    </select>
{indent}  </Field>
{indent}) : null}}'''
    source = source[:end] + denomination_field + source[end:]

    review_marker = "value={priceReviewLabel(price, priceType, text)}"
    if source.count(review_marker) != 1:
        raise RuntimeError(f"price review: expected one marker, found {source.count(review_marker)}")
    review_start = source.index(review_marker)
    value_line_start = source.rfind("\n", 0, review_start) + 1
    value_indent = source[value_line_start:review_start]
    row_indent = value_indent[:-2]
    source = source.replace(
        review_marker,
        "value={priceReviewLabel(price, priceType, priceDenomination, text)}",
        1,
    )
    review_end = source.index("/>", review_start) + 2
    denomination_review = f'''\n{row_indent}{{(priceType === "fixed" || priceType === "negotiable") && price ? (
{row_indent}  <ReviewRow
{row_indent}    label={{text("وحدة السعر", "Price denomination")}}
{row_indent}    value={{
{row_indent}      priceDenomination === "old"
{row_indent}        ? text("ليرة سورية قديمة", "Old Syrian pounds")
{row_indent}        : priceDenomination === "new"
{row_indent}          ? text("ليرة سورية جديدة", "New Syrian pounds")
{row_indent}          : text("غير مصنّفة", "Unclassified")
{row_indent}    }}
{row_indent}  />
{row_indent}) : null}}'''
    source = source[:review_end] + denomination_review + source[review_end:]

    source = replace_once(
        source,
        '? `${price} SYP`',
        "? priceReviewLabel(price, priceType, priceDenomination, text)",
        "listing preview price",
    )
    ADD_LISTING_PATH.write_text(source)


def verify_generated_shape() -> None:
    source = ADD_LISTING_PATH.read_text()
    required = [
        'useState<SypPriceDenomination>("unclassified")',
        "priceDenomination,\n      priceType,",
        'error={fieldErrors.priceDenomination}',
        "priceReviewLabel(price, priceType, priceDenomination, text)",
        "priceDenomination: SypPriceDenomination",
    ]
    for token in required:
        if token not in source:
            raise RuntimeError(f"generated add-listing integration missing: {token}")


prepare_patch_script()
subprocess.run(["node", str(PATCH_PATH)], check=True)
integrate_add_listing()
verify_generated_shape()
print("SYP Phase A preflight patch applied successfully.")
