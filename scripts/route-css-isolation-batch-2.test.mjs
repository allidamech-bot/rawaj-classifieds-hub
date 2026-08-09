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
  "messaging-v4.css",
  "communication-center-v3.css",
  "activity-more-foundation.css",
  "personal-space-polish.css",
  "trust-support-hub-v2.css",
];

test("eight secondary page styles leave direct root imports", () => {
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
  assert.match(
    routeStyles,
    /trustSupport:\s*\[[\s\S]*"\/more"[\s\S]*"\/support"[\s\S]*"\/privacy"/,
  );
});

test("more route loads both personal-space and trust-support style layers", () => {
  assert.match(routeStyles, /personalSpace:[\s\S]*"\/more"/);
  assert.match(
    routeStyles,
    /trustSupport:\s*\[[\s\S]*"\/more"[\s\S]*"\/support"[\s\S]*"\/privacy"/,
  );
});

test("root conditionally emits all secondary route style groups", () => {
  for (const href of [
    "listingStudioSignature",
    "listingStudioV2",
    "listingStudioV3",
    "messagingV4",
    "communicationCenterV2",
    "activityMoreFoundation",
    "personalSpacePolish",
    "trustSupportHubV2",
  ]) {
    assert.match(root, new RegExp(`routeStyleHrefs\\.${href}`));
  }

  assert.match(root, /routeStyleScope\.listingStudio/);
  assert.match(root, /routeStyleScope\.messaging/);
  assert.match(root, /routeStyleScope\.communication/);
  assert.match(root, /routeStyleScope\.personalSpace/);
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
    root.indexOf("routeStyleHrefs.messagingV4") >
      root.indexOf("routeStyleHrefs.communicationCenterV2"),
  );
});

test("quality gate remains read-only", () => {
  assert.match(qualityGate, /contents: read/);
  assert.doesNotMatch(qualityGate, /contents: write/);
});
