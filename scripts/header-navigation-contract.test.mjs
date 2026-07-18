import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const header = await readFile(
  new URL("../src/components/shell/FloatingHeader.tsx", import.meta.url),
  "utf8",
);

test("mobile header keeps secondary controls off small screens", () => {
  assert.match(header, /toggleLanguage[\s\S]*lg:inline-flex/);
  assert.doesNotMatch(header, /toggleLanguage[\s\S]*sm:inline-flex/);
});

test("header typography respects functional minimums", () => {
  assert.doesNotMatch(header, /text-\[8px\]|text-\[9px\]|text-\[10px\]/);
  assert.match(header, /text-\[11px\]/);
  assert.match(header, /text-\[#b63f24\]/);
  assert.match(header, /dark:text-\[#ff9a7d\]/);
});

test("header controls expose mobile touch targets", () => {
  assert.match(header, /min-h-11/);
  assert.match(header, /rawaj-touch-target/);
});

test("brand home link accessible name contains its visible RAWAJ label", () => {
  assert.match(header, /رواج RAWAJ، العودة إلى الرئيسية/);
  assert.match(header, /RAWAJ, back to home/);
});
