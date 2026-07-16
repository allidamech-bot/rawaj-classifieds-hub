import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, routeStyles, qualityGate] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

const scopedStyles = [
  "listing-studio-signature.css",
  "listing-studio-v2.css",
  "listing-studio-v3.css",
  "messaging-signature.css",
  "communication-center-v2.css",
  "activity-more-foundation.css",
  "personal-space-polish.css",
  "my-store-redesign.css",
  "my-store-header-refinement.css",
  "my-store-brand-polish.css",
  "trust-support-hub-v2.css",
];

test("eleven secondary page styles leave direct root imports", () => {
  for (const stylesheet of scopedStyles) {
    assert.doesNotMatch(
      root,
      new RegExp(`from "\\.\\./${stylesheet.replaceAll(".", "\\.")}\\?url"`),
    );
    assert.match(routeStyles, new RegExp(`${stylesheet.replaceAll(".", "\\.")}\\?url`));
  }
});

test("secondary route groups are explicit and exclude unrelated surfaces", () => {
  assert.match(routeStyles, /normalizedPathname === "\/add-listing"/);
  assert.match(routeStyles, /\^\\\/profile\\\/listings\\\/\[\^\/\]\+\$/);
  assert.match(routeStyles, /messaging: normalizedPathname === "\/chats"/);
  assert.match(routeStyles, /communication: \["\/chats", "\/notifications", "\/activity"\]/);
  assert.match(routeStyles, /ownerStore: normalizedPathname === "\/profile\/listings"/);
  assert.match(routeStyles, /trustSupport: \["\/support", "\/safety", "\/terms", "\/privacy"\]/);
  assert.doesNotMatch(routeStyles, /ownerStore:.*profile\/listings\//);
});

test("root conditionally emits all secondary route style groups", () => {
  for (const href of [
    "listingStudioSignature",
    "listingStudioV2",
    "listingStudioV3",
    "messagingSignature",
    "communicationCenterV2",
    "activityMoreFoundation",
    "personalSpacePolish",
    "myStoreRedesign",
    "myStoreHeaderRefinement",
    "myStoreBrandPolish",
    "trustSupportHubV2",
  ]) {
    assert.match(root, new RegExp(`routeStyleHrefs\\.${href}`));
  }

  assert.match(root, /routeStyleScope\.listingStudio/);
  assert.match(root, /routeStyleScope\.messaging/);
  assert.match(root, /routeStyleScope\.communication/);
  assert.match(root, /routeStyleScope\.personalSpace/);
  assert.match(root, /routeStyleScope\.ownerStore/);
  assert.match(root, /routeStyleScope\.trustSupport/);
});

test("secondary style cascade remains stable inside each route group", () => {
  assert.ok(
    root.indexOf("routeStyleHrefs.listingStudioV2") >
      root.indexOf("routeStyleHrefs.listingStudioSignature"),
  );
  assert.ok(
    root.indexOf("routeStyleHrefs.listingStudioV3") >
      root.indexOf("routeStyleHrefs.listingStudioV2"),
  );
  assert.ok(
    root.indexOf("routeStyleHrefs.communicationCenterV2") >
      root.indexOf("routeStyleHrefs.messagingSignature"),
  );
  assert.ok(
    root.indexOf("routeStyleHrefs.myStoreHeaderRefinement") >
      root.indexOf("routeStyleHrefs.myStoreRedesign"),
  );
  assert.ok(
    root.indexOf("routeStyleHrefs.myStoreBrandPolish") >
      root.indexOf("routeStyleHrefs.myStoreHeaderRefinement"),
  );
});

test("quality gate permanently enforces route CSS batch 2 read-only", () => {
  assert.match(qualityGate, /Route CSS isolation batch 2 contract/);
  assert.match(qualityGate, /node --test scripts\/route-css-isolation-batch-2\.test\.mjs/);
  assert.match(qualityGate, /contents: read/);
  assert.doesNotMatch(qualityGate, /contents: write/);
});
