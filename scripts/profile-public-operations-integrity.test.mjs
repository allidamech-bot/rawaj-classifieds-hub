import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [profile, seller, activity, offers, ownerListings] = await Promise.all([
  readFile(new URL("../src/routes/profile.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/seller.$id.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/activity.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/offers.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/profile/listings.tsx", import.meta.url), "utf8"),
]);

test("profile account actions are single-flight and exception safe", () => {
  assert.match(profile, /const logoutInFlightRef = useRef\(false\);/);
  assert.match(profile, /async function handleLogout[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(profile, /setLoggingOut\(false\)/);
  assert.match(profile, /disabled=\{loggingOut\}/);
  assert.match(profile, /aria-busy=\{loggingOut\}/);
  assert.match(profile, /newPassword\.length < 8/);
  assert.match(profile, /handleChangePassword[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(profile, /handleRequestAccountDeletion[\s\S]*?catch \(caught\)[\s\S]*?finally/);
});

test("profile data and media payloads are normalized and recover after failures", () => {
  for (const field of [
    "settingsFirstName.trim()",
    "settingsLastName.trim()",
    "settingsDisplayName.trim()",
    "settingsGovernorate.trim()",
    "settingsCityArea.trim()",
    "settingsBio.trim()",
    "settingsBusinessName.trim()",
    "settingsPhone.trim()",
    "settingsWhatsapp.trim()",
  ]) {
    assert.ok(profile.includes(field), `Missing normalized profile field: ${field}`);
  }
  assert.match(profile, /handleSaveProfileBasics[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(profile, /handleUploadProfileMedia[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(profile, /handleRemoveProfileMedia[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(profile, /operation: "profile_listings_load"/);
  assert.match(profile, /operation: "profile_verification_load"/);
});

test("seller eligibility and review submission are guarded", () => {
  assert.match(seller, /const loadEligibility = useCallback[\s\S]*?catch \(caught\)/);
  assert.match(seller, /const currentComment = comment\.trim\(\);/);
  assert.match(seller, /currentComment\.length > 0 && currentComment\.length < 10/);
  assert.match(seller, /submitReview[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(seller, /aria-busy=\{saving\}/);
  assert.ok((seller.match(/disabled=\{saving\}/g) ?? []).length >= 3);
});

test("activity and offers loading actions cannot remain stuck", () => {
  assert.match(activity, /operation: "activity_notifications_load"/);
  assert.match(activity, /operation: "activity_conversations_load"/);
  assert.match(activity, /loadNotifications[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(activity, /loadConversations[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(offers, /const retryInFlightRef = useRef\(false\);/);
  assert.match(offers, /async function retryOffers[\s\S]*?try \{[\s\S]*?finally/);
  assert.match(offers, /actionDisabled=\{retrying\}/);
  assert.match(offers, /aria-busy=\{actionDisabled\}/);
});

test("owner listing lifecycle operations are synchronous single-flight", () => {
  for (const refName of [
    "deleteInFlightRef",
    "lifecycleInFlightRef",
    "reservationInFlightRef",
    "priceDropInFlightRef",
  ]) {
    assert.ok(ownerListings.includes(`const ${refName} = useRef(false);`), `Missing ${refName}`);
  }
  for (const handler of [
    "handleConfirmDelete",
    "handleClose",
    "handleReservationToggle",
    "handlePriceDrop",
    "handleReactivate",
    "handleExpiryUpdate",
  ]) {
    assert.match(
      ownerListings,
      new RegExp(`async function ${handler}[\\s\\S]*?try \\{[\\s\\S]*?catch \\(caught\\)[\\s\\S]*?finally`),
    );
  }
  assert.match(ownerListings, /nextPrice >= listing\.price/);
  assert.match(ownerListings, /operation: "owner_listings_load"/);
  assert.match(ownerListings, /operation: "owner_store_load"/);
});
