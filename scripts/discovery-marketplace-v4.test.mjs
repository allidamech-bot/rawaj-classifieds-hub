import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, css, home, categories, listings, detail, cards] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/discovery-marketplace-v4.css", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/categories.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/listings.index.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/listings.$id.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/listings/cards/ListingCardShared.tsx", import.meta.url),
    "utf8",
  ),
]);

test("phase 3 marketplace layer loads after the canonical design foundation", () => {
  assert.match(root, /import discoveryMarketplaceV4Css/);
  assert.ok(
    root.indexOf("href: discoveryMarketplaceV4Css") > root.indexOf("href: designFoundationCss"),
  );
});

test("phase 3 covers every core discovery surface without changing routes", () => {
  for (const contract of [
    ".rawaj-discovery-hero",
    ".rawaj-category-directory-card",
    ".rawaj-search-toolbar",
    ".rawaj-adaptive-card",
    ".rawaj-detail-summary",
  ]) {
    assert.match(css, new RegExp(contract.replaceAll(".", "\\.")));
  }
  assert.match(home, /<DiscoveryHero/);
  assert.match(categories, /rawaj-category-directory-card/);
  assert.match(listings, /<SearchResultsToolbar/);
  assert.match(detail, /rawaj-detail-summary/);
  assert.match(cards, /rawaj-adaptive-card/);
});

test("marketplace typography and controls retain accessible minimums", () => {
  assert.doesNotMatch(css, /font-size:\s*0\.[0-5]rem/);
  assert.match(css, /min-height:\s*2\.75rem/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /var\(--rawaj-card-background\)/);
  assert.match(css, /var\(--rawaj-border\)/);
});

test("directory and result pages keep a single semantic page heading", () => {
  assert.match(categories, /titleIsPageHeading=\{false\}/);
  assert.match(listings, /titleIsPageHeading=\{false\}/);
});
