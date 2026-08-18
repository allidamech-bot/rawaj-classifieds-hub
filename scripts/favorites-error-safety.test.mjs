import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const favorites = await readFile(new URL("../src/routes/favorites.tsx", import.meta.url), "utf8");

test("favorites never place upstream or caught exception messages into customer UI", () => {
  assert.doesNotMatch(favorites, /setActionMessage\(result\.error\.message\)/);
  assert.doesNotMatch(favorites, /caught instanceof Error[\s\S]*?caught\.message/);
  assert.match(favorites, /تعذر تحميل المفضلة\. حاول مرة أخرى\./);
  assert.match(favorites, /تعذر إزالة الإعلان من المفضلة\./);
});
