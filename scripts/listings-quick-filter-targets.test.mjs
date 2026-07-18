import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const quickFilters = await readFile(
  new URL("../src/features/search/QuickFilterRail.tsx", import.meta.url),
  "utf8",
);

test("listings quick controls open their intended filter sections", () => {
  assert.match(
    quickFilters,
    /type QuickFilterSection = "location" \| "price" \| "category" \| "condition"/,
  );
  assert.match(quickFilters, /onClick=\{\(\) => openSection\("location"\)\}/);
  assert.match(quickFilters, /onClick=\{\(\) => openSection\("price"\)\}/);
  assert.match(quickFilters, /onClick=\{\(\) => openSection\("category"\)\}/);
  assert.match(quickFilters, /onClick=\{\(\) => openSection\("condition"\)\}/);
  assert.match(quickFilters, /\.rawaj-filter-sheet__section/);
  assert.match(quickFilters, /target\.scrollIntoView/);
  assert.match(quickFilters, /\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(
    quickFilters,
    /<MapPin[\s\S]{0,160}onClick=\{onOpenFilters\}|<Tag[\s\S]{0,160}onClick=\{onOpenFilters\}/,
  );
});
