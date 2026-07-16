import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [comparison, dock, compatibility, root, css] = await Promise.all([
  readFile(new URL("../src/features/comparison/listing-comparison.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/comparison/ListingComparisonDock.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/features/listings/RealListingCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/comparison-foundation.css", import.meta.url), "utf8"),
]);

test("comparison is limited to meaningful marketplace groups", () => {
  assert.match(
    comparison,
    /export type ComparisonGroup = "vehicles" \| "real_estate" \| "electronics"/,
  );
  assert.match(comparison, /export const MAX_COMPARISON_ITEMS = 3/);
  assert.match(comparison, /resolveListingCardVariant\(listing\)/);
  assert.match(comparison, /details\.electronics_brand \|\| details\.storage \|\| details\.ram/);
  assert.match(comparison, /entries\[0\]\.group !== group/);
});

test("comparison state persists locally without adding a backend data contract", () => {
  assert.match(comparison, /rawaj:listing-comparison:v1/);
  assert.match(comparison, /window\.localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(comparison, /window\.localStorage\.setItem\(STORAGE_KEY/);
  assert.match(comparison, /window\.addEventListener\("storage"/);
  assert.doesNotMatch(comparison, /from\("listing_comparisons"\)/);
});

test("marketplace cards expose an accessible comparison action", () => {
  assert.match(compatibility, /isListingComparisonEligible\(listing\)/);
  assert.match(compatibility, /<CompareListingButton listing=\{listing\}/);
  assert.match(comparison, /aria-pressed=\{active\}/);
  assert.match(comparison, /event\.preventDefault\(\)/);
  assert.match(comparison, /event\.stopPropagation\(\)/);
});

test("root keeps the provider eager and defers the heavy comparison dock", () => {
  assert.match(root, /<ListingComparisonProvider>/);
  assert.match(root, /function ListingComparisonDockBoundary/);
  assert.match(root, /if \(entries\.length === 0\) return null/);
  assert.match(root, /import\("@\/features\/comparison\/ListingComparisonDock"\)/);
  assert.match(root, /<LazyListingComparisonDock \/>/);
  assert.match(root, /comparison-foundation\.css\?url/);
  assert.match(root, /href: comparisonFoundationCss/);
  assert.doesNotMatch(comparison, /@\/components\/ui\/dialog/);
  assert.doesNotMatch(comparison, /ListingCardImage/);
  assert.match(dock, /@\/components\/ui\/dialog/);
  assert.match(dock, /ListingCardImage/);
});

test("comparison workspace preserves complete dialog and table behavior", () => {
  assert.match(dock, /export default function ListingComparisonDock/);
  assert.match(dock, /<Dialog open=\{open\} onOpenChange=\{setOpen\}>/);
  assert.match(dock, /buildComparisonRows\(entries, language, text\)/);
  assert.match(dock, /formatPriceLocalized/);
  assert.match(dock, /listingLocationDisplay/);
  assert.match(dock, /comparisonGroupLabel/);
  assert.match(dock, /conditionLabel/);
});

test("comparison workspace is mobile-safe and reduced-motion aware", () => {
  assert.match(css, /bottom: calc\(5\.75rem \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /min-width: 46rem/);
  assert.match(css, /@media \(min-width: 768px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
