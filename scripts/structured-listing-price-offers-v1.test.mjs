import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const [migration, handler, entry, api, component, chats, barrel, packageJson] = await Promise.all([
  readFile("cloudflare/d1/migrations/0019_structured_listing_price_offers.sql", "utf8"),
  readFile("cloudflare/worker/src/listing-offers.ts", "utf8"),
  readFile("cloudflare/worker/src/entry.ts", "utf8"),
  readFile("src/lib/api/listing-price-offers.ts", "utf8"),
  readFile("src/features/communication/ConversationPriceOffers.tsx", "utf8"),
  readFile("src/routes/chats.tsx", "utf8"),
  readFile("src/lib/classifieds-api.ts", "utf8"),
  readFile("package.json", "utf8"),
]);

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE auth_users (id TEXT PRIMARY KEY);
    CREATE TABLE listings (id TEXT PRIMARY KEY);
    CREATE TABLE conversations (id TEXT PRIMARY KEY);
    CREATE TABLE notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
  db.exec(migration);
  for (const id of ["buyer", "seller"]) {
    db.prepare("INSERT INTO auth_users (id) VALUES (?)").run(id);
  }
  db.prepare("INSERT INTO listings (id) VALUES ('listing')").run();
  db.prepare("INSERT INTO conversations (id) VALUES ('conversation')").run();
  return db;
}

function insertPending(db, overrides = {}) {
  const row = {
    id: crypto.randomUUID(),
    listingId: "listing",
    conversationId: "conversation",
    buyerId: "buyer",
    sellerId: "seller",
    createdBy: "buyer",
    parentId: null,
    amount: 1000,
    currency: "SYP",
    requestId: crypto.randomUUID(),
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
  db.prepare(
    `INSERT INTO listing_price_offers
    (id, listing_id, conversation_id, buyer_id, seller_id, created_by,
     parent_offer_id, amount, currency, status, expires_at, client_request_id,
     created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.listingId,
    row.conversationId,
    row.buyerId,
    row.sellerId,
    row.createdBy,
    row.parentId,
    row.amount,
    row.currency,
    "2026-08-04T00:00:00.000Z",
    row.requestId,
    row.createdAt,
    row.createdAt,
  );
  return row;
}

test("migration stores immutable offer history with one pending offer per conversation", () => {
  const db = database();
  insertPending(db);
  assert.throws(() => insertPending(db), /UNIQUE constraint failed/);
  db.exec("UPDATE listing_price_offers SET status = 'countered' WHERE status = 'pending'");
  insertPending(db, { createdBy: "seller" });
  assert.equal(db.prepare("SELECT count(*) AS count FROM listing_price_offers").get().count, 2);
});

test("migration rejects self offers, unsafe amounts, and duplicate request ids", () => {
  const db = database();
  assert.throws(() => insertPending(db, { sellerId: "buyer" }), /CHECK constraint failed/);
  assert.throws(() => insertPending(db, { amount: 0 }), /CHECK constraint failed/);
  const requestId = crypto.randomUUID();
  insertPending(db, { requestId });
  db.exec("UPDATE listing_price_offers SET status = 'rejected' WHERE status = 'pending'");
  assert.throws(() => insertPending(db, { requestId }), /UNIQUE constraint failed/);
});

test("Worker contract enforces authentication, participant ownership, blocking and stale writes", () => {
  assert.match(handler, /requireMutationAuth/);
  assert.match(handler, /c\.buyer_id = \? OR c\.seller_id = \?/);
  assert.match(handler, /user_blocks/);
  assert.match(handler, /client_request_id/);
  assert.match(handler, /last_action_request_id/);
  assert.match(handler, /expectedUpdatedAt/);
  assert.match(handler, /stale_write/);
  assert.match(handler, /Only the buyer can create the first offer/);
  assert.match(handler, /Only the recipient can respond/);
  assert.match(handler, /Only the sender can withdraw/);
});

test("offer lifecycle creates actionable conversation notifications", () => {
  assert.match(handler, /offer\.received/);
  assert.match(handler, /offer\.countered/);
  assert.match(handler, /`offer\.\$\{nextStatus\}`/);
  assert.match(handler, /action === "accept"/);
  assert.match(handler, /action === "reject"/);
  assert.match(handler, /action === "withdraw"/);
  assert.match(handler, /targetType: "conversation"/);
  assert.match(handler, /offerId:/);
  assert.match(handler, /amount:/);
});

test("offer routes never capture the existing price-drop endpoint", () => {
  assert.match(entry, /handleListingOffers/);
  assert.match(entry, /\(\?!price-drops\$\)/);
  const operationsIndex = entry.indexOf("isListingOperationsPath(path)");
  const offersIndex = entry.indexOf("isListingOfferPath(path)");
  assert.ok(operationsIndex >= 0 && offersIndex > operationsIndex);
});

test("typed client and chat UI expose the structured offer journey", () => {
  assert.match(api, /fetchConversationPriceOffers/);
  assert.match(api, /createConversationPriceOffer/);
  assert.match(api, /transitionListingPriceOffer/);
  assert.match(api, /expectedUpdatedAt/);
  assert.match(component, /data-price-offer-panel="true"/);
  for (const action of ["create", "accept", "reject", "counter", "withdraw"]) {
    assert.match(component, new RegExp(`data-price-offer-action="${action}"`));
  }
  assert.match(component, /does not automatically mark the listing sold/);
  assert.match(component, /listingAvailable/);
  assert.match(component, /enabled/);
  assert.match(chats, /ConversationPriceOffers/);
  assert.match(chats, /selectedConversation\.status === "active"/);
  assert.match(barrel, /api\/listing-price-offers/);
  assert.match(handler, /role: conversation\.buyer_id === auth\.userId/);
  assert.match(handler, /listingAvailable:/);
});

test("focused contract is permanently included in precheck", () => {
  const parsed = JSON.parse(packageJson);
  assert.equal(
    parsed.scripts["test:listing-price-offers"],
    "node --test scripts/structured-listing-price-offers-v1.test.mjs",
  );
  assert.match(parsed.scripts.precheck, /test:listing-price-offers/);
});
