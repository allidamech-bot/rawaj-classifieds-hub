import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { calculateListingQuality } from "../src/lib/listing-quality.ts";
import { analyzeMessageSafety } from "../src/lib/message-safety.ts";

const [addListingRoute, manageListingRoute, chatsRoute, packageJson, focusedWorkflow] =
  await Promise.all([
    readFile(new URL("../src/routes/add-listing.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/profile/listings.$id.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(
      new URL("../.github/workflows/listing-quality-chat-safety.yml", import.meta.url),
      "utf8",
    ),
  ]);

test("listing quality uses weighted, category-aware checks", () => {
  const incomplete = calculateListingQuality({
    categoryReady: true,
    title: "سيارة للبيع",
    description: "وصف قصير",
    imageCount: 0,
    priceReady: true,
    locationReady: true,
    categoryFieldKind: "vehicles",
    categoryDetails: {},
    condition: "used",
  });
  assert.ok(incomplete.score < 70);
  assert.equal(incomplete.ready, false);
  assert.equal(incomplete.totalWeight, 100);

  const complete = calculateListingQuality({
    categoryReady: true,
    title: "سيارة عائلية بحالة ممتازة للبيع",
    description:
      "سيارة نظيفة للاستخدام العائلي مع صيانة دورية ومعلومات واضحة عن الحالة والمواصفات ومكان المعاينة.",
    imageCount: 3,
    priceReady: true,
    locationReady: true,
    categoryFieldKind: "vehicles",
    categoryDetails: { car_make: "Toyota", car_model: "Corolla", year: 2021 },
    condition: "used",
  });
  assert.equal(complete.score, 100);
  assert.equal(complete.ready, true);
});

test("message safety distinguishes ordinary, caution, and confirmation-required content", () => {
  assert.deepEqual(analyzeMessageSafety("هل يمكن المعاينة غداً؟"), {
    level: "safe",
    flags: [],
    requiresConfirmation: false,
  });

  const linked = analyzeMessageSafety("راجع التفاصيل على https://example.com");
  assert.equal(linked.level, "caution");
  assert.deepEqual(linked.flags, ["external_link"]);
  assert.equal(linked.requiresConfirmation, false);

  const payment = analyzeMessageSafety("حوّل عربون قبل المعاينة على الحساب");
  assert.equal(payment.level, "danger");
  assert.ok(payment.flags.includes("advance_payment"));
  assert.equal(payment.requiresConfirmation, true);

  const credential = analyzeMessageSafety("أرسل رمز التحقق OTP الآن");
  assert.equal(credential.level, "danger");
  assert.ok(credential.flags.includes("credential_request"));
  assert.equal(credential.requiresConfirmation, true);
});

test("create and manage listing studios consume one shared quality contract", () => {
  for (const route of [addListingRoute, manageListingRoute]) {
    assert.match(route, /calculateListingQuality/);
    assert.match(route, /listingQualityCheckLabel/);
    assert.match(route, /quality\.checks\.map/);
    assert.doesNotMatch(route, /filter\(Boolean\)\.length \* 20/);
  }
  assert.match(addListingRoute, /selectedImages\.filter/);
  assert.match(manageListingRoute, /images\.length \+/);
});

test("chat composer warns early and requires a scoped deliberate second send", () => {
  assert.match(chatsRoute, /analyzeMessageSafety/);
  assert.match(chatsRoute, /confirmedRisk\?\.scopeKey !== scopeKey/);
  assert.match(chatsRoute, /confirmedRisk\.body !== cleanBody/);
  assert.match(chatsRoute, /messageSafety\.requiresConfirmation/);
  assert.match(chatsRoute, /confirmedRisk\?\.scopeKey === composerScopeKey/);
  assert.match(chatsRoute, /تأكيد وإرسال/);
  assert.match(chatsRoute, /role="status"/);
  assert.doesNotMatch(chatsRoute, /sendConversationMessage[\s\S]{0,300}bypass/i);
});

test("quality and chat safety remain permanent CI contracts", () => {
  assert.match(packageJson, /"test:listing-quality-chat-safety"/);
  assert.match(packageJson, /npm run test:listing-quality-chat-safety/);
  assert.match(focusedWorkflow, /Listing Quality and Chat Safety V1 contract/);
  assert.match(focusedWorkflow, /npm run test:listing-quality-chat-safety/);
  assert.match(focusedWorkflow, /npm run typecheck/);
});
