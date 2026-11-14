import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [repairCss, stabilityCss, detailCss, foundationCss] = await Promise.all([
  readFile(new URL("../src/rawaj-live-repair-sweep-v22.css", import.meta.url), "utf8"),
  readFile(new URL("../src/stability-accessibility-fixes.css", import.meta.url), "utf8"),
  readFile(new URL("../src/listing-detail-v3.css", import.meta.url), "utf8"),
  readFile(new URL("../src/design-foundation.css", import.meta.url), "utf8"),
]);

test("listing studio decorative backdrop cannot widen the document", () => {
  assert.match(stabilityCss, /@import "\.\/rawaj-live-repair-sweep-v22\.css";/);
  assert.match(
    repairCss,
    /\.rawaj-listing-studio-v4::before\s*\{[\s\S]*?inset-inline: auto !important;[\s\S]*?left: 50% !important;[\s\S]*?right: auto !important/,
  );
  assert.match(
    repairCss,
    /\.rawaj-listing-studio-v4::before\s*\{[\s\S]*?width: min\(76rem, 96vw\) !important;[\s\S]*?max-width: 96vw !important/,
  );
});

test("listing studio four-step rail stays inside the document width", () => {
  assert.match(
    repairCss,
    /\.rawaj-studio-steps\s*\{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\) !important/,
  );
  assert.match(
    repairCss,
    /\.rawaj-studio-steps\s*\{[\s\S]*?max-width: 100% !important;[\s\S]*?min-width: 0 !important;[\s\S]*?overflow: hidden !important/,
  );
  assert.match(
    repairCss,
    /\.rawaj-studio-steps[\s\S]*?> li[\s\S]*?min-width: 0 !important/,
  );
  assert.match(
    repairCss,
    /\.rawaj-studio-steps__copy[\s\S]*?strong[\s\S]*?text-overflow: ellipsis !important/,
  );
});

test("listing studio active step and preview count keep readable contrast", () => {
  assert.match(
    repairCss,
    /li\[data-state="active"\][\s\S]*?\.rawaj-studio-steps__copy[\s\S]*?small\s*\{[\s\S]*?color: var\(--studio-v5-text-soft, #c7c7cd\) !important/,
  );
  assert.match(
    repairCss,
    /\.rawaj-studio-preview__heading[\s\S]*?> span\s*\{[\s\S]*?color: var\(--studio-v5-text, #f4f1ed\) !important/,
  );
});

test("listing detail retains mobile media and safe-area dock within canonical route ownership", () => {
  assert.doesNotMatch(repairCss, /data-resolved-pathname\^="\/listings\/"/);
  assert.match(detailCss, /@media \(max-width: 767px\)/);
  assert.match(detailCss, /aspect-ratio: 4 \/ 3/);
  assert.match(detailCss, /env\(safe-area-inset-bottom, 0px\)/);
  assert.match(detailCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(foundationCss, /rawaj-shell-bottom-reserve/);
});
