import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [more, addListing, manageListing, listingDetail, seller, chats, packageJson] =
  await Promise.all([
    readFile(new URL("../src/routes/more.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/add-listing.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/profile/listings_.$id.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/listings.$id.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/seller.$id.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

test("session actions are synchronously deduplicated", () => {
  assert.match(more, /const logoutInFlightRef = useRef\(false\)/);
  assert.match(more, /if \(logoutInFlightRef\.current\) return/);
  assert.match(more, /finally \{/);
  assert.match(more, /disabled: loggingOut/);
});

test("listing create and edit setup loads expose retry and stale-read guards", () => {
  assert.match(addListing, /const setupRequestIdRef = useRef\(0\)/);
  assert.match(addListing, /const loadSetup = useCallback/);
  assert.match(addListing, /onClick=\{\(\) => void loadSetup\(\)\}/);
  assert.match(manageListing, /const setupRequestIdRef = useRef\(0\)/);
  assert.match(manageListing, /const imagesRequestIdRef = useRef\(0\)/);
  assert.match(manageListing, /const saveInFlightRef = useRef\(false\)/);
  assert.match(manageListing, /const resubmitInFlightRef = useRef\(false\)/);
  assert.match(manageListing, /const deleteInFlightRef = useRef\(false\)/);
  assert.match(manageListing, /Retry photos|إعادة تحميل الصور/);
});

test("public listing actions cannot be duplicated", () => {
  assert.match(listingDetail, /const reportInFlightRef = useRef\(false\)/);
  assert.match(listingDetail, /const messageInFlightRef = useRef<string \| null>\(null\)/);
  assert.match(listingDetail, /const alertInFlightRef = useRef\(false\)/);
  assert.match(listingDetail, /reportInFlightRef\.current = false/);
  assert.match(
    listingDetail,
    /profileGenerationRef\.current === startProfileGeneration[\s\S]*messageInFlightRef\.current === startProfileId/,
  );
});

test("seller review eligibility is retryable and review writes are account-scoped", () => {
  assert.match(seller, /const loadEligibility = useCallback/);
  assert.match(seller, /const eligibilityRequestIdRef = useRef\(0\)/);
  assert.match(seller, /const reviewSubmitScopesRef = useRef<Set<string>>\(new Set\(\)\)/);
  assert.match(seller, /reviewSubmitScopesRef\.current\.has\(scopeKey\)/);
  assert.match(seller, /reviewSubmitScopesRef\.current\.delete\(scopeKey\)/);
  assert.match(seller, /currentSellerId !== sellerIdRef\.current/);
  assert.doesNotMatch(seller, /reviewerUserId:/);
  assert.match(seller, /onClick=\{\(\) => void loadEligibility\(\)\}/);
});

test("chat refresh failures preserve snapshots and sensitive writes are deduplicated", () => {
  assert.equal(
    chats.includes("setConversations([]);\n      setConversationError(result.error)"),
    false,
  );
  assert.equal(chats.includes("setMessages([]);\n      setMessageError(result.error)"), false);
  assert.match(chats, /const sendInFlightScopesRef = useRef<Set<string>>\(new Set\(\)\)/);
  assert.match(chats, /sendInFlightScopesRef\.current\.has\(scopeKey\)/);
  assert.match(chats, /const reportInFlightRef = useRef<Set<string>>\(new Set\(\)\)/);
  assert.match(chats, /const blockInFlightRef = useRef<Set<string>>\(new Set\(\)\)/);
  assert.match(chats, /finally \{/);
});

test("final user journey contract remains available for local validation", () => {
  assert.match(packageJson, /"test:final-user-journeys"/);
});
