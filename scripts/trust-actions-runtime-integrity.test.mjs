import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [support, verification, promotion] = await Promise.all([
  readFile(new URL("../src/routes/support.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/verification.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/promotion.tsx", import.meta.url), "utf8"),
]);

test("support history and submission are validation and exception safe", () => {
  assert.match(support, /operation: "support_requests_load"/);
  assert.match(support, /const loadRequests = useCallback[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(support, /cleanSubject\.length < 4/);
  assert.match(support, /cleanMessage\.length < 10/);
  assert.match(support, /async function submitRequest[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(support, /aria-busy=\{submitting\}/);
});

test("verification history and form remain usable after failures", () => {
  assert.match(verification, /operation: "verification_requests_load"/);
  assert.match(verification, /const loadRequests = useCallback[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(verification, /legalName\.trim\(\)\.length < 3/);
  assert.match(verification, /legalName: legalName\.trim\(\)/);
  assert.match(verification, /businessName\.trim\(\)/);
  assert.match(verification, /aria-busy=\{saving\}/);
  assert.ok((verification.match(/disabled=\{saving\}/g) ?? []).length >= 4);
});

test("Search Boost creation is single-flight and uses the shared eligibility guard", () => {
  assert.match(promotion, /const submitInFlightRef = useRef\(false\);/);
  assert.match(promotion, /if \(!profileId \|\| submitInFlightRef\.current\) return;/);
  assert.match(promotion, /isListingEligibleForSearchBoost/);
  assert.match(promotion, /eligibleListings\.some\(\(listing\) => listing\.id === selectedListingId\)/);
  assert.match(promotion, /createSearchBoostRequest\(\{/);
  assert.match(promotion, /paymentMethod,/);
  assert.match(promotion, /paymentReference,/);
  assert.match(promotion, /async function submit[\s\S]*?catch \(error\)[\s\S]*?finally/);
  assert.match(promotion, /submitInFlightRef\.current = false/);
  assert.match(promotion, /aria-busy=\{saving\}/);
});

test("Search Boost receipt failure does not encourage duplicate submission", () => {
  assert.match(promotion, /The request was created, but the receipt could not upload/);
  assert.match(promotion, /Do not resubmit/);
  assert.match(promotion, /await loadOrders\(\)/);
});
