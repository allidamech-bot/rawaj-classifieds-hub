import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [categoriesData, references, liveChat, chatCss] = await Promise.all([
  readFile(new URL("../src/features/categories/public-categories-page-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/references.ts", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/communication/useLiveChatWorkspace.ts", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/communication-center-v3.css", import.meta.url), "utf8"),
]);

test("categories own their visual styles instead of relying only on root head state", () => {
  assert.match(categoriesData, /import "\.\.\/\.\.\/listings-results\.css";/);
  assert.match(categoriesData, /import "\.\.\/\.\.\/search-filters-v1\.css";/);
  assert.match(categoriesData, /import "\.\.\/\.\.\/search-filters-v2\.css";/);
});

test("public category references do not inherit signed-in session transitions", () => {
  assert.match(references, /import \{ publicSupabase \} from "@\/lib\/supabase";/);
  assert.match(references, /function getPublicReferenceClient\(\)/);
  assert.match(references, /if \(publicSupabase\) return \{ ok: true, data: publicSupabase \};/);
  for (const name of [
    "fetchPublicCategories",
    "fetchPublicSubcategories",
    "fetchPublicTaxonomyNodes",
    "fetchPublicGovernorates",
  ]) {
    const start = references.indexOf(`export async function ${name}`);
    assert.ok(start >= 0, `${name} must exist`);
    const body = references.slice(start, start + 420);
    assert.match(body, /getPublicReferenceClient\(\)/, `${name} must use the public client`);
  }
});

test("chat route styles survive auth refresh and explicit hidden state always wins", () => {
  assert.match(liveChat, /import "\.\.\/\.\.\/communication-center-v3\.css";/);
  assert.match(
    chatCss,
    /\.rawaj-message-workspace \.rawaj-message-panel\.hidden \{[\s\S]*display: none !important;/,
  );
});
