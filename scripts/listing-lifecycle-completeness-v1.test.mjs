import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [ownerListings, lifecycleApi, worker, packageJson] = await Promise.all([
  readFile(new URL("../src/routes/profile/listings.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-lifecycle.ts", import.meta.url), "utf8"),
  readFile(new URL("../cloudflare/worker/src/listing-operations.ts", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("approved owners can explicitly confirm listing availability", () => {
  assert.match(ownerListings, /confirmOwnerListingAvailability/);
  assert.match(ownerListings, /async function handleAvailabilityConfirm\(\)/);
  assert.match(ownerListings, /تأكيد أنه متوفر|Confirm availability/);
  assert.match(lifecycleApi, /export function confirmOwnerListingAvailability/);
  assert.match(worker, /action === "confirm_availability"/);
});

test("closing and reactivation require an explicit confirmation dialog", () => {
  assert.match(ownerListings, /type LifecycleConfirmation =/);
  assert.match(ownerListings, /pendingLifecycleConfirmation/);
  assert.match(ownerListings, /role="dialog"/);
  assert.match(ownerListings, /aria-modal="true"/);
  assert.match(ownerListings, /ownerLifecycleConfirmationCopy/);

  for (const status of ["sold", "rented", "unavailable"]) {
    assert.match(
      ownerListings,
      new RegExp(`action:\\s*"close",[\\s\\S]*?targetStatus:\\s*"${status}"`),
    );
  }

  assert.match(ownerListings, /action: "reactivate"/);
  assert.doesNotMatch(
    ownerListings,
    /onClick=\{\(\) => void handleClose\("(?:sold|rented|unavailable)"\)\}/,
  );
  assert.doesNotMatch(ownerListings, /onClick=\{\(\) => void handleReactivate\(\)\}/);
});

test("rejected listings explain the reason and the next corrective step", () => {
  assert.match(ownerListings, /listing.status === "rejected"/);
  assert.match(ownerListings, /سبب رفض الإعلان|Listing rejection reason/);
  assert.match(ownerListings, /إعادة الإرسال للمراجعة|resubmit-for-review/);
});

test("lifecycle actions remain single-flight and backend transitions stay constrained", () => {
  assert.match(ownerListings, /const lifecycleInFlightRef = useRef\(false\)/);
  assert.match(ownerListings, /if \(lifecycleInFlightRef.current/);
  assert.match(worker, /Only approved listings may be closed/);
  assert.match(worker, /Listing cannot be reactivated from its current state/);
  assert.match(worker, /Available approved listing required/);
});

test("the lifecycle completeness contract runs in precheck", () => {
  const parsed = JSON.parse(packageJson);
  assert.equal(
    parsed.scripts["test:listing-lifecycle-completeness"],
    "node --test scripts/listing-lifecycle-completeness-v1.test.mjs",
  );
  assert.match(parsed.scripts.precheck, /test:listing-lifecycle-completeness/);
});
