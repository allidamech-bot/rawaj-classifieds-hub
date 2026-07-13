import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [rootRoute, detailRoute, mediaExperience, mediaViewer, v2Css, v3Css] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/listings.$id.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/listing-detail/ListingMediaExperience.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../src/features/listing-detail/ListingMediaViewer.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/listing-detail-v2.css", import.meta.url), "utf8"),
  readFile(new URL("../src/listing-detail-v3.css", import.meta.url), "utf8"),
]);

const layeredCss = `${v2Css}\n${v3Css}`;

test("Listing Detail V3 stylesheet is loaded after V2", () => {
  assert.match(rootRoute, /listingDetailV3Css from "\.\.\/listing-detail-v3\.css\?url"/);
  assert.ok(
    rootRoute.indexOf("href: listingDetailV3Css") > rootRoute.indexOf("href: listingDetailV2Css"),
    "V3 must load after V2 so it remains an additive override layer",
  );
});

test("Listing Detail V3 preserves the complete listing experience", () => {
  for (const component of [
    "ListingMediaExperience",
    "ListingContactDock",
    "ListingSellerProfileCard",
    "ListingSafetyAndAlert",
    "SimilarListingsRail",
  ]) {
    assert.match(detailRoute, new RegExp(`<${component}`));
  }

  assert.match(detailRoute, /listing\.reservedAt/);
  assert.match(detailRoute, /rawaj-detail-specs/);
  assert.match(detailRoute, /rawaj-detail-description/);
  assert.match(detailRoute, /rawaj-detail-location/);
});

test("media experience keeps swipe, fullscreen, keyboard, zoom, and accessible controls", () => {
  assert.match(mediaExperience, /onTouchStart=\{handleTouchStart\}/);
  assert.match(mediaExperience, /onTouchEnd=\{handleTouchEnd\}/);
  assert.match(mediaExperience, /setViewerOpen\(true\)/);
  assert.match(mediaViewer, /event\.key === "ArrowLeft"/);
  assert.match(mediaViewer, /Math\.min\(3, value \+ 0\.5\)/);
  assert.match(mediaExperience, /aria-pressed=\{favorite\}/);
  assert.match(mediaViewer, /DialogPrimitive\.Title/);
  assert.match(mediaViewer, /DialogPrimitive\.Description/);
});

test("full media viewer is excluded from the initial listing-detail bundle", () => {
  assert.match(mediaExperience, /lazy\(\(\) => import\("\.\/ListingMediaViewer"\)\)/);
  assert.match(mediaExperience, /viewerOpen \? \(/);
  assert.match(mediaExperience, /<Suspense fallback=\{null\}>/);
  assert.doesNotMatch(mediaExperience, /@radix-ui\/react-dialog/);
  assert.match(mediaViewer, /@radix-ui\/react-dialog/);
  assert.match(mediaViewer, /loading="lazy" decoding="async"/);
});

test("layered V2 and V3 CSS retains mobile-first, bidirectional, safe-area, and motion contracts", () => {
  for (const token of [
    "env(safe-area-inset-left)",
    "@media (max-width: 767px)",
    "@media (min-width: 1024px)",
    "@media (prefers-reduced-motion: reduce)",
    "inset-inline-start",
    "inset-inline-end",
    ":focus-visible",
  ]) {
    assert.ok(layeredCss.includes(token), `Missing layered detail contract token: ${token}`);
  }

  assert.doesNotMatch(v3Css, /@import\s+url/i);
  assert.match(v3Css, /\.rawaj-detail-v2__sidebar\s*\{[^}]*position:\s*sticky/s);
  assert.doesNotMatch(v3Css, /\.rawaj-detail-v2__sidebar\s*\{[^}]*position:\s*fixed/s);
});
