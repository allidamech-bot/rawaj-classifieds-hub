import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, css, gate] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/desktop-experience-v1.css", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("desktop layer loads after page-specific redesign styles", () => {
  assert.match(root, /desktopExperienceV1Css/);
  const desktopIndex = root.indexOf("href: desktopExperienceV1Css");
  assert.ok(desktopIndex > root.indexOf("href: listingDetailV2Css"));
  assert.ok(desktopIndex > root.indexOf("href: communicationCenterV2Css"));
});

test("desktop composition defines coherent content and sidebar geometry", () => {
  assert.match(css, /--rawaj-desktop-content: 86rem/);
  assert.match(css, /--rawaj-desktop-sidebar: 20rem/);
  assert.match(css, /\.container-wide/);
  assert.match(css, /\.rawaj-search-results-v1/);
  assert.match(css, /\.rawaj-detail-v2__layout/);
  assert.match(css, /\.rawaj-listing-studio-v3 \.rawaj-studio-shell/);
});

test("desktop card density remains view-aware", () => {
  assert.match(css, /\.rawaj-results-grid\.listing-card-grid/);
  assert.match(css, /\.rawaj-results-grid\[data-view="list"\]/);
  assert.match(css, /@media \(min-width: 1536px\)/);
  assert.match(css, /repeat\(5, minmax\(0, 1fr\)\)/);
});

test("sticky regions are viewport bounded instead of page length traps", () => {
  assert.match(css, /max-height: calc\(100dvh/);
  assert.match(css, /overflow-y: auto/);
  assert.match(css, /overscroll-behavior: contain/);
});

test("desktop experience preserves logical direction and reduced motion", () => {
  assert.doesNotMatch(css, /margin-left|margin-right|padding-left|padding-right/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /transition: none/);
});

test("quality gate runs desktop contract read-only", () => {
  assert.match(gate, /contents: read/);
  assert.match(gate, /Desktop Experience V1 contract/);
  assert.doesNotMatch(gate, /contents: write/);
});
