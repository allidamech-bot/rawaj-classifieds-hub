import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, shared, more, support, safety, css, qualityGate] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/trust/TrustSupportExperience.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/more.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/support.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/safety.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/trust-support-hub-v2.css", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("trust support V2 stylesheet loads after account and support foundations", () => {
  assert.match(root, /import trustSupportHubV2Css from "\.\.\/trust-support-hub-v2\.css\?url"/);
  const account = root.indexOf("href: activityMoreFoundationCss");
  const trust = root.indexOf("href: trustSupportHubV2Css");
  assert.notEqual(account, -1);
  assert.notEqual(trust, -1);
  assert.ok(trust > account);
});

test("shared trust components state platform limits without unsupported promises", () => {
  for (const component of [
    "TrustHubHero",
    "TrustSectionHeader",
    "SafetyGuideCard",
    "SupportRequestTimeline",
    "TrustLinkCard",
  ]) {
    assert.match(shared, new RegExp(`export function ${component}`));
  }
  assert.match(shared, /without promises of an instant reply/);
  assert.match(shared, /does not handle payments, guarantees, or escrow/);
  assert.doesNotMatch(shared, /guaranteed response|buyer protection included|escrow protected/i);
});

test("more hub keeps account admin language session and navigation behavior", () => {
  assert.match(more, /rawaj-more-v2/);
  assert.match(more, /<TrustHubHero/);
  assert.match(more, /primaryShortcuts/);
  assert.match(more, /secondaryShortcuts/);
  assert.match(more, /const unreadTotal = counts\.messages \+ counts\.notifications/);
  assert.match(more, /toggleLanguage/);
  assert.match(more, /auth\.canAccessOwnerControls/);
  assert.match(more, /auth\.signOut\(\)/);
  assert.match(more, /to: "\/support"/);
  assert.match(more, /to: "\/safety"/);
  assert.match(more, /to: "\/privacy"/);
  assert.match(more, /to: "\/terms"/);
});

test("support keeps stored request submission and history with shared timeline", () => {
  assert.match(support, /rawaj-support-v2/);
  assert.match(support, /<TrustHubHero/);
  assert.match(support, /<SupportRequestTimeline/);
  assert.match(support, /createSupportRequest/);
  assert.match(support, /fetchMySupportRequests/);
  assert.match(support, /relatedListingId/);
  assert.match(support, /supportStatusLabel|SupportRequestTimeline/);
  assert.match(support, /No stored support requests yet|لا توجد طلبات دعم/);
  assert.doesNotMatch(support, /instant reply|reply within/i);
});

test("safety uses shared factual guide cards and keeps platform payment disclaimer", () => {
  assert.match(safety, /rawaj-safety-v2/);
  assert.match(safety, /<TrustHubHero/);
  assert.match(safety, /<SafetyGuideCard/);
  assert.match(safety, /لا يوجد نظام دفع داخل رَوَاج حالياً/);
  assert.match(safety, /does not provide in-app payment/);
  assert.match(safety, /to="\/prohibited"/);
  assert.match(safety, /to="\/support"/);
});

test("trust support UI is responsive logical-property based and reduced-motion safe", () => {
  assert.match(css, /\.rawaj-trust-hero/);
  assert.match(css, /\.rawaj-support-timeline/);
  assert.match(css, /\.rawaj-safety-guide/);
  assert.match(css, /inset-inline/);
  assert.match(css, /@media \(min-width: 900px\)/);
  assert.match(css, /@media \(max-width: 389px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("quality gate permanently runs trust support V2 read-only", () => {
  assert.match(qualityGate, /contents: read/);
  assert.match(qualityGate, /Trust Support Hub V2 contract/);
  assert.match(qualityGate, /node --test scripts\/trust-support-hub-v2\.test\.mjs/);
  assert.doesNotMatch(qualityGate, /contents: write/);
});
