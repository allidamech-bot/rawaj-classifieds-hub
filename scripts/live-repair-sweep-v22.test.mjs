import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [repairCss, stabilityCss] = await Promise.all([
  readFile(new URL("../src/rawaj-live-repair-sweep-v22.css", import.meta.url), "utf8"),
  readFile(new URL("../src/stability-accessibility-fixes.css", import.meta.url), "utf8"),
]);

test("listing studio four-step rail stays inside the document width", () => {
  assert.match(stabilityCss, /@import "\.\/rawaj-live-repair-sweep-v22\.css";/);
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

test("listing detail mobile media and contact dock keep the summary readable", () => {
  assert.match(
    repairCss,
    /data-resolved-pathname\^="\/listings\/"[\s\S]*?\.rawaj-detail-media__stage[\s\S]*?aspect-ratio: 4 \/ 3 !important/,
  );
  assert.match(
    repairCss,
    /\.rawaj-detail-v2__container[\s\S]*?padding-bottom: calc\(6rem \+ env\(safe-area-inset-bottom, 0px\)\) !important/,
  );
  assert.match(
    repairCss,
    /\.rawaj-contact-dock__inner[\s\S]*?min-height: 3\.45rem !important/,
  );
});
