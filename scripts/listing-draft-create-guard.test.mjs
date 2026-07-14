import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const guardedSource = await readFile(
  new URL("../src/lib/api/listing-draft-create-guarded.ts", import.meta.url),
  "utf8",
);
const apiBarrelSource = await readFile(
  new URL("../src/lib/classifieds-api.ts", import.meta.url),
  "utf8",
);

test("owner draft creation reuses one in-flight request for an identical payload", () => {
  assert.match(guardedSource, /ownerDraftCreationRequests = new Map/);
  assert.match(guardedSource, /const existing = ownerDraftCreationRequests\.get\(requestKey\)/);
  assert.match(guardedSource, /existing\.expiresAt === null/);
  assert.match(guardedSource, /return existing\.promise/);
  assert.match(guardedSource, /stablePayloadKey\(payload\)/);
});

test("successful draft creation starts a bounded duplicate-click reuse window", () => {
  assert.match(guardedSource, /SUCCESS_REUSE_WINDOW_MS = 30_000/);
  assert.match(guardedSource, /record\.expiresAt = Date\.now\(\) \+ SUCCESS_REUSE_WINDOW_MS/);
  assert.match(guardedSource, /record = \{ promise: request, expiresAt: null \}/);
  assert.match(
    guardedSource,
    /if \(!result\.ok\) \{\s*ownerDraftCreationRequests\.delete\(requestKey\)/,
  );
});

test("public classifieds API routes draft creation through the guarded boundary", () => {
  assert.match(
    apiBarrelSource,
    /export \{ createOwnerDraftListing \} from "@\/lib\/api\/listing-draft-create-guarded";/,
  );
});
