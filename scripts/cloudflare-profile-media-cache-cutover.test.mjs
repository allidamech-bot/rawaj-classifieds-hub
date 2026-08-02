import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const policy = fs.readFileSync(
  new URL("../cloudflare/worker/src/profile-media-cache.ts", import.meta.url),
  "utf8",
);
const entry = fs.readFileSync(
  new URL("../cloudflare/worker/src/entry.ts", import.meta.url),
  "utf8",
);

test("profile media responses are not stored by browser or CDN caches", () => {
  assert.match(policy, /public_profiles/);
  assert.match(policy, /avatar_asset_id/);
  assert.match(policy, /cover_asset_id/);
  assert.match(policy, /Cache-Control", "no-store, max-age=0"/);
  assert.match(policy, /CDN-Cache-Control/);
  assert.match(policy, /Cloudflare-CDN-Cache-Control/);
  assert.match(policy, /return noStore\(response\)/);
});

test("public media routing applies the profile-only cache policy", () => {
  assert.match(entry, /applyProfileMediaCachePolicy/);
  assert.match(entry, /const response = required\(await handlePublicCore\(request, env\)\)/);
  assert.match(entry, /return applyProfileMediaCachePolicy\(path, response, env\)/);
});
