import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [packageJson, rootRoute] = await Promise.all([
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
]);

test("Vercel Analytics package remains installed", () => {
  const manifest = JSON.parse(packageJson);
  assert.match(manifest.dependencies?.["@vercel/analytics"] ?? "", /^\^2\./);
});

test("root shell renders Analytics before router scripts", () => {
  assert.match(rootRoute, /import \{ Analytics \} from "@vercel\/analytics\/react";/);
  const analyticsIndex = rootRoute.indexOf("<Analytics />");
  const scriptsIndex = rootRoute.indexOf("<Scripts />");
  assert.notEqual(analyticsIndex, -1);
  assert.notEqual(scriptsIndex, -1);
  assert.ok(analyticsIndex < scriptsIndex);
});
