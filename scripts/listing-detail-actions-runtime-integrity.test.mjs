import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = await Promise.all([
  "src/routes/listings.$id.tsx",
  "src/features/listing-detail/ListingMediaExperience.tsx",
  "src/features/listing-detail/ListingSafetyAndAlert.tsx",
  "src/features/listing-detail/ListingSellerProfileCard.tsx",
  "src/features/listing-detail/ListingContactDock.tsx",
].map((path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")));
const [route, media, safety, seller, dock] = files;

test("favorite, report, message, and alert actions are single-flight", () => {
  for (const state of ["favoriteBusy", "reportBusy", "messageBusy", "alertBusy"]) {
    assert.ok(route.includes(state), `Missing action state: ${state}`);
  }
  assert.match(route, /favoriteInFlightRef\.current/);
  assert.match(route, /reportInFlightRef\.current/);
  assert.match(route, /messageInFlightRef\.current/);
  assert.match(route, /alertInFlightRef\.current/);
});

test("listing detail mutations report thrown failures and always unlock", () => {
  assert.match(route, /async function reportListing[\s\S]*?catch[\s\S]*?finally/);
  assert.match(route, /async function messageSeller[\s\S]*?await navigate[\s\S]*?catch[\s\S]*?finally/);
  assert.match(route, /async function createPriceAlert[\s\S]*?catch[\s\S]*?finally/);
  assert.match(route, /setReportBusy\(false\)/);
  assert.match(route, /setMessageBusy\(false\)/);
  assert.match(route, /setAlertBusy\(false\)/);
});

test("listing detail controls expose their action state", () => {
  assert.match(media, /disabled=\{favoriteBusy\}/);
  assert.match(media, /aria-busy=\{favoriteBusy\}/);
  assert.match(safety, /disabled=\{reportBusy\}/);
  assert.match(safety, /aria-busy=\{reportBusy\}/);
  assert.match(seller, /disabled=\{messageBusy\}/);
  assert.match(dock, /disabled=\{messageBusy\}/);
  assert.ok((dock.match(/aria-busy=\{messageBusy\}/g) ?? []).length >= 2);
});
