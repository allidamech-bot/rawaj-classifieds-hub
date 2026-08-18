import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [repairCss, stabilityCss] = await Promise.all([
  readFile(new URL("../src/rawaj-live-repair-sweep-v22.css", import.meta.url), "utf8"),
  readFile(new URL("../src/stability-accessibility-fixes.css", import.meta.url), "utf8"),
]);

test("listing detail mobile media and contact dock keep the summary readable", () => {
  assert.match(stabilityCss, /@import "\.\/rawaj-live-repair-sweep-v22\.css";/);
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
