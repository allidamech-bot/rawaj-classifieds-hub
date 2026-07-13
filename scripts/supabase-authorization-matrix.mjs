#!/usr/bin/env node

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = required("SUPABASE_URL");
const anonKey = required("SUPABASE_ANON_KEY");
const mode = process.env.RAWAJ_AUTH_MATRIX_MODE ?? "read-only";
const accounts = parseSecretJson("RAWAJ_AUTH_MATRIX_ACCOUNTS");
const fixtures = parseSecretJson("RAWAJ_AUTH_MATRIX_FIXTURES");

if (!["read-only", "staging-mutation"].includes(mode)) {
  throw new Error("RAWAJ_AUTH_MATRIX_MODE must be read-only or staging-mutation.");
}
if (mode === "staging-mutation" && fixtures.environment !== "staging") {
  throw new Error("Mutation mode requires a fixture manifest with environment=staging.");
}

const anon = client();
const owner = await signedInClient("owner");
const other = await signedInClient("other");
const staff = await signedInClient("staff");
const blocked = accounts.blocked ? await signedInClient("blocked") : null;

await verifyReadMatrix();
if (mode === "staging-mutation") await verifyMutationMatrix();

console.log(`RAWAJ Supabase authorization matrix passed (${mode}).`);

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseSecretJson(name) {
  try {
    return JSON.parse(required(name));
  } catch {
    throw new Error(`${name} must be valid JSON. Its value is never logged.`);
  }
}

function client() {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function signedInClient(role) {
  const credentials = accounts[role];
  if (!credentials?.email || !credentials?.password) {
    throw new Error(`Missing dedicated ${role} credentials in RAWAJ_AUTH_MATRIX_ACCOUNTS.`);
  }
  const scoped = client();
  const { data, error } = await scoped.auth.signInWithPassword(credentials);
  assert.ifError(error);
  assert.ok(data.user, `${role} account did not establish a session`);
  return { client: scoped, user: data.user };
}

async function rows(scoped, table, columns, idColumn, id) {
  const response = await scoped.from(table).select(columns).eq(idColumn, id);
  return response.error ? { denied: true, data: [] } : { denied: false, data: response.data ?? [] };
}

async function expectInvisible(scoped, table, columns, idColumn, id, label) {
  const result = await rows(scoped, table, columns, idColumn, id);
  assert.equal(result.data.length, 0, `${label} leaked through ${table}`);
}

async function expectVisible(scoped, table, columns, idColumn, id, label) {
  const result = await rows(scoped, table, columns, idColumn, id);
  assert.equal(result.denied, false, `${label} read was denied unexpectedly`);
  assert.equal(result.data.length, 1, `${label} was not visible exactly once`);
}

async function expectRpcDenied(scoped, name, args, label) {
  const { error } = await scoped.rpc(name, args);
  assert.ok(error, `${label} unexpectedly executed ${name}`);
}

async function verifyReadMatrix() {
  const publicListingId = requiredFixture("publicListingId");
  const privateListingId = requiredFixture("privateListingId");

  await expectVisible(
    anon,
    "listings",
    "id,status",
    "id",
    publicListingId,
    "anonymous public listing",
  );
  await expectInvisible(
    anon,
    "listings",
    "id,status",
    "id",
    privateListingId,
    "anonymous private listing",
  );
  await expectVisible(
    owner.client,
    "listings",
    "id,status,owner_id",
    "id",
    privateListingId,
    "owner private listing",
  );
  await expectInvisible(
    other.client,
    "listings",
    "id,status",
    "id",
    privateListingId,
    "other user's private listing",
  );

  await expectVisible(
    owner.client,
    "profiles",
    "id,email,phone,whatsapp",
    "id",
    owner.user.id,
    "own private profile",
  );
  await expectInvisible(
    anon,
    "profiles",
    "id,email,phone,whatsapp",
    "id",
    owner.user.id,
    "anonymous private profile",
  );
  await expectInvisible(
    other.client,
    "profiles",
    "id,email,phone,whatsapp",
    "id",
    owner.user.id,
    "other user's private profile",
  );

  for (const [key, table, idColumn, columns] of [
    ["ownerNotificationId", "notifications", "id", "id,user_id"],
    ["ownerSupportRequestId", "support_requests", "id", "id,user_id"],
    ["ownerConversationId", "conversations", "id", "id,buyer_user_id,seller_user_id"],
    ["ownerMessageId", "conversation_messages", "id", "id,conversation_id,sender_user_id"],
  ]) {
    const id = requiredFixture(key);
    await expectInvisible(anon, table, columns, idColumn, id, `anonymous ${table}`);
    await expectInvisible(other.client, table, columns, idColumn, id, `horizontal ${table}`);
  }

  for (const [key, table, idColumn, columns] of [
    ["ownerSavedSearchId", "saved_searches", "id", "id,user_id,filters"],
    ["ownerListingReportId", "listing_reports", "id", "id,reporter_id,status"],
    ["ownerMessageReportId", "message_reports", "id", "id,reporter_user_id,status"],
    ["ownerUserBlockId", "user_blocks", "id", "id,blocker_user_id,blocked_user_id"],
    ["ownerPendingSellerReviewId", "seller_reviews", "id", "id,reviewer_user_id,status"],
  ]) {
    const id = requiredFixture(key);
    await expectVisible(owner.client, table, columns, idColumn, id, `owner ${table}`);
    await expectInvisible(anon, table, columns, idColumn, id, `anonymous private ${table}`);
    await expectInvisible(other.client, table, columns, idColumn, id, `horizontal ${table}`);
  }

  await expectVisible(
    owner.client,
    "notification_preferences",
    "user_id,messages_enabled,reviews_enabled",
    "user_id",
    owner.user.id,
    "own account notification settings",
  );
  await expectInvisible(
    other.client,
    "notification_preferences",
    "user_id,messages_enabled,reviews_enabled",
    "user_id",
    owner.user.id,
    "other user's account notification settings",
  );

  await expectRpcDenied(
    other.client,
    "rawaj_review_queue_pending",
    {},
    "ordinary user admin boundary",
  );
  await expectRpcDenied(
    other.client,
    "rawaj_admin_fetch_users",
    {},
    "ordinary user user-management boundary",
  );
  await expectRpcDenied(
    other.client,
    "rawaj_fetch_message_reports_for_admin",
    {},
    "ordinary user report boundary",
  );

  const queue = await staff.client.rpc("rawaj_review_queue_pending");
  assert.ifError(queue.error);
  const messageReports = await staff.client.rpc("rawaj_fetch_message_reports_for_admin");
  assert.ifError(messageReports.error);
  const adminUsers = await staff.client.rpc("rawaj_admin_fetch_users");
  if (fixtures.staffCanManageUsers === true) assert.ifError(adminUsers.error);
  else assert.ok(adminUsers.error, "moderator unexpectedly received user-management access");

  if (blocked) {
    await expectRpcDenied(
      blocked.client,
      "rawaj_review_queue_pending",
      {},
      "blocked user admin boundary",
    );
  }
}

function requiredFixture(name) {
  const value = fixtures[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`RAWAJ_AUTH_MATRIX_FIXTURES.${name} is required.`);
  }
  return value.trim();
}

async function verifyMutationMatrix() {
  const marker = `RAWAJ-AUTH-MATRIX-${Date.now()}`;
  const categoryId = requiredFixture("categoryId");
  const governorateId = requiredFixture("governorateId");
  let listingId = null;
  let storagePath = null;

  try {
    const created = await owner.client
      .from("listings")
      .insert({
        owner_id: owner.user.id,
        category_id: categoryId,
        governorate_id: governorateId,
        title: marker,
        description: "Dedicated staging authorization fixture",
        price: null,
        price_type: "contact",
        listing_condition: "used",
        status: "draft",
        contact_options: { message: true },
        details: { _rawaj_test: { marker, disposable: true } },
      })
      .select("id,owner_id,status")
      .single();
    assert.ifError(created.error);
    listingId = created.data.id;

    await expectInvisible(
      other.client,
      "listings",
      "id,status",
      "id",
      listingId,
      "other user's new draft",
    );
    const horizontalUpdate = await other.client
      .from("listings")
      .update({ title: `${marker}-tampered` })
      .eq("id", listingId)
      .select("id");
    assert.equal(horizontalUpdate.data?.length ?? 0, 0, "other user updated an owner's listing");

    const ownerIdTamper = await owner.client
      .from("listings")
      .update({ owner_id: other.user.id })
      .eq("id", listingId)
      .select("id");
    assert.ok(
      ownerIdTamper.error || (ownerIdTamper.data?.length ?? 0) === 0,
      "owner_id was client mutable",
    );

    const ownerUpdate = await owner.client.rpc("rawaj_owner_update_listing_v2", {
      p_listing_id: listingId,
      p_patch: { title: `${marker}-updated` },
    });
    assert.ifError(ownerUpdate.error);

    storagePath = `${owner.user.id}/${listingId}/matrix.png`;
    const pixel = Uint8Array.from(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    const upload = await owner.client.storage
      .from("listing-images")
      .upload(storagePath, pixel, { contentType: "image/png", upsert: false });
    assert.ifError(upload.error);
    const otherDownload = await other.client.storage.from("listing-images").download(storagePath);
    assert.ok(otherDownload.error, "other user downloaded a private draft image");

    const blockedInsert = blocked
      ? await blocked.client.from("listings").insert({
          owner_id: blocked.user.id,
          category_id: categoryId,
          governorate_id: governorateId,
          title: `${marker}-blocked`,
          description: "Must be denied",
          price_type: "contact",
          listing_condition: "used",
          status: "draft",
          contact_options: { message: true },
          details: { _rawaj_test: { marker, disposable: true } },
        })
      : null;
    if (blockedInsert) assert.ok(blockedInsert.error, "blocked user created a listing");

    const submitted = await owner.client.rpc("rawaj_submit_listing_for_review", {
      p_listing_id: listingId,
    });
    assert.ifError(submitted.error);
    const pending = await owner.client
      .from("listings")
      .select("updated_at,status")
      .eq("id", listingId)
      .single();
    assert.ifError(pending.error);
    assert.equal(pending.data.status, "pending_review");

    const ordinaryModeration = await other.client.rpc("rawaj_review_listing_decision", {
      p_listing_id: listingId,
      p_decision: "rejected",
      p_reason: "Authorization matrix denial check",
      p_expected_updated_at: pending.data.updated_at,
    });
    assert.ok(ordinaryModeration.error, "ordinary user moderated a listing");

    const staffModeration = await staff.client.rpc("rawaj_review_listing_decision", {
      p_listing_id: listingId,
      p_decision: "rejected",
      p_reason: "Dedicated staging authorization fixture",
      p_expected_updated_at: pending.data.updated_at,
    });
    assert.ifError(staffModeration.error);

    const ownerDelete = await owner.client
      .from("listings")
      .delete()
      .eq("id", listingId)
      .select("id");
    assert.ifError(ownerDelete.error);
    assert.equal(
      ownerDelete.data?.length,
      1,
      "owner could not delete the disposable rejected fixture",
    );
    listingId = null;
  } finally {
    if (storagePath) await owner.client.storage.from("listing-images").remove([storagePath]);
    if (listingId) await owner.client.from("listings").delete().eq("id", listingId);
    for (const session of [owner, other, staff, blocked].filter(Boolean)) {
      await session.client.auth.signOut({ scope: "local" });
    }
  }
}
