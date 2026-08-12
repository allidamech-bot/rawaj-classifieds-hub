import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const header = await readFile(
  new URL("../src/components/shell/FloatingHeader.tsx", import.meta.url),
  "utf8",
);
const brand = await readFile(
  new URL("../src/components/shell/BrandLockup.tsx", import.meta.url),
  "utf8",
);
const footer = await readFile(new URL("../src/components/SiteFooter.tsx", import.meta.url), "utf8");

test("mobile header keeps secondary controls off small screens", () => {
  assert.match(header, /toggleLanguage[\s\S]*lg:inline-flex/);
  assert.doesNotMatch(header, /toggleLanguage[\s\S]*sm:inline-flex/);
});

test("header typography respects functional minimums while allowing compact numeric badges", () => {
  assert.doesNotMatch(header, /text-\[8px\]|text-\[9px\]/);
  assert.match(header, /to="\/login"[\s\S]*text-\[11px\][\s\S]*sm:text-xs/);
  assert.match(header, /adminUnread[\s\S]*text-\[10px\]/);
  assert.match(brand, /text-\[11px\]/);
});

test("global shell shares one bilingual brand lockup", () => {
  assert.match(header, /<BrandLockup/);
  assert.match(footer, /<BrandLockup inverse/);
  assert.match(brand, /rawaj-mark-transparent-192\.png/);
  assert.match(brand, />\s*رواج\s*</);
  assert.match(brand, />\s*RAWAJ\s*</);
  assert.match(footer, /rawaj-site-footer/);
});

test("header controls expose mobile touch targets", () => {
  assert.match(header, /min-h-11/);
  assert.match(header, /rawaj-touch-target/);
});
