import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createFirebaseAuthFixture } from "./firebase-auth-fixture.mjs";

const port = 8792;
const baseUrl = `http://127.0.0.1:${port}`;
const testIp = `203.0.113.${(Date.now() % 200) + 1}`;
let worker;
let owner;
let other;
let admin;
let moderator;
let listingId;
let imageId;
let auth;

before(async () => {
  auth = await createFirebaseAuthFixture();
  worker = spawn(
    process.execPath,
    [
      fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url)),
      "dev",
      "--config",
      "wrangler.generated.jsonc",
      "--local",
      "--persist-to",
      ".wrangler/test-state-auth",
      "--port",
      String(port),
      ...auth.workerArgs,
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/v1/health`)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  worker.stderr.on("data", (data) => {
    console.error("[worker stderr]", data.toString());
  });
  worker.stdout.on("data", (data) => {
    console.error("[worker stdout]", data.toString());
  });
  owner = await signup("owner");
  other = await signup("other");
  admin = await signup("admin");
  moderator = await signup("moderator");
  await assignRole(owner.userId, "owner");
  await assignRole(admin.userId, "admin");
  await assignRole(moderator.userId, "moderator");
  await new Promise((resolve) => setTimeout(resolve, 500));
});

after(() => worker?.kill());

test("profile access, validation, bearer authentication, and immutable identity", async () => {
  assert.equal((await api("/api/profile")).response.status, 401);

  const read = await api("/api/profile", owner);
  assert.equal(read.response.status, 200);
  assert.equal(read.payload.data.id, owner.userId);

  const noCsrf = await api("/api/profile", {
    ...owner,
    method: "PATCH",
    body: { displayName: "Updated Owner" },
  });
  assert.equal(noCsrf.response.status, 200);

  const malformed = await fetch(`${baseUrl}/api/profile`, {
    method: "PATCH",
    headers: headers(owner, { "Content-Type": "application/json" }),
    body: "{",
  });
  assert.equal(malformed.status, 400);

  const invalid = await api("/api/profile", {
    ...owner,
    method: "PATCH",
    body: { displayName: "X" },
  });
  assert.equal(invalid.response.status, 400);

  const update = await api("/api/profile", {
    ...owner,
    method: "PATCH",
    body: {
      userId: other.userId,
      role: "admin",
      displayName: "Updated Owner",
      firstName: "Updated",
      phone: "+963900000000",
      bio: "Local profile test",
    },
  });
  assert.equal(update.response.status, 200);
  assert.equal(update.payload.data.id, owner.userId);
  assert.equal(update.payload.data.displayName, "Updated Owner");
  assert.equal(update.payload.data.phone, "+963900000000");
});

test("production CORS preflight exposes authenticated request headers", async () => {
  const response = await fetch(`${baseUrl}/api/profile`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://rawa-j.com",
      "Access-Control-Request-Method": "PATCH",
      "Access-Control-Request-Headers": "authorization,content-type,idempotency-key,if-none-match",
    },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://rawa-j.com");
  assert.match(response.headers.get("access-control-allow-headers") ?? "", /Idempotency-Key/);
  assert.match(response.headers.get("access-control-allow-headers") ?? "", /If-None-Match/);
});

test("notification preferences return defaults and persist an authenticated update", async () => {
  const initial = await api("/v1/account/notification-preferences", owner);
  assert.equal(initial.response.status, 200);
  assert.equal(initial.payload.data.messagesEnabled, true);

  const updated = await api("/v1/account/notification-preferences", {
    ...owner,
    method: "PATCH",
    body: { key: "messagesEnabled", enabled: false },
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.data.messagesEnabled, false);
});

test("public ad placements route returns a successful collection", async () => {
  const result = await api("/v1/ad-placements?page=home&device=desktop");
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.payload.data));
});

test("listing creation security, reads, filtering, ownership, and deletion", async () => {
  const input = listingInput();
  assert.equal((await api("/v1/listings", { method: "POST", body: input })).response.status, 401);
  assert.equal(
    (
      await api("/v1/listings", {
        ...owner,
        method: "POST",
        body: { ...input, categoryId: "missing" },
      })
    ).response.status,
    400,
  );

  const created = await api("/v1/listings", { ...owner, method: "POST", body: input });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.data.status, "draft");
  listingId = created.payload.data.id;

  assert.equal((await api(`/api/listings/${listingId}`)).response.status, 404);
  const ownerRead = await api(`/api/listings/${listingId}`, owner);
  assert.equal(ownerRead.response.status, 200);
  assert.equal(ownerRead.payload.data.listing.ownerId, owner.userId);

  const publicRead = await api("/api/listings/test-public-listing");
  assert.equal(publicRead.response.status, 200);
  const filtered = await api(
    "/api/listings?categoryId=test-category&governorateId=test-governorate&priceMin=200&priceMax=300&page=1&pageSize=1&q=اختبار",
  );
  assert.equal(filtered.response.status, 200);
  assert.equal(filtered.payload.data.items.length, 1);
  assert.equal(filtered.payload.data.pageSize, 1);

  assert.equal(
    (
      await api(`/v1/listings/${listingId}`, {
        ...other,
        method: "PATCH",
        body: listingInput(),
      })
    ).response.status,
    403,
  );
  const updated = await api(`/v1/listings/${listingId}`, {
    ...owner,
    method: "PATCH",
    body: {
      ...listingInput(),
      title: "Updated listing title",
      ownerId: other.userId,
      status: "approved",
    },
  });
  assert.equal(updated.response.status, 200);
  const afterUpdate = await api(`/api/listings/${listingId}`, owner);
  assert.equal(afterUpdate.payload.data.listing.ownerId, owner.userId);
  assert.equal(afterUpdate.payload.data.listing.status, "draft");

  assert.equal(
    (
      await api(`/v1/listings/${listingId}`, {
        ...other,
        method: "DELETE",
      })
    ).response.status,
    403,
  );
});

test("R2 upload constraints, ownership, deletion, and cleanup", async () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  assert.equal((await upload(other, png, "image/png")).response.status, 403);
  assert.equal(
    (await upload(owner, new TextEncoder().encode("bad"), "text/plain")).response.status,
    400,
  );
  const oversized = new Uint8Array(8 * 1024 * 1024 + 1);
  oversized.set(png);
  assert.equal((await upload(owner, oversized, "image/png")).response.status, 400);

  const uploaded = await upload(owner, png, "image/png");
  assert.equal(uploaded.response.status, 201);
  imageId = uploaded.payload.data.id;
  assert.match(uploaded.payload.data.publicUrl, /^\/v1\/account\/media\/assets\//);
  const delivered = await fetch(`${baseUrl}${uploaded.payload.data.publicUrl}`, {
    headers: headers(owner),
  });
  assert.equal(delivered.status, 200);
  assert.match(delivered.headers.get("cache-control") ?? "", /max-age/);

  const listed = await api(`/v1/listings/${listingId}/images`, owner);
  assert.equal(listed.response.status, 200);
  assert.equal(listed.payload.data.length, 1);

  assert.equal(
    (
      await api(`/v1/listing-images/${imageId}`, {
        ...other,
        method: "DELETE",
        body: { objectKey: "listings/arbitrary" },
      })
    ).response.status,
    403,
  );
  const deleted = await api(`/v1/listing-images/${imageId}`, {
    ...owner,
    method: "DELETE",
    body: { objectKey: "listings/arbitrary" },
  });
  assert.equal(deleted.response.status, 200);
  assert.equal((await api(`/v1/listings/${listingId}/images`, owner)).payload.data.length, 0);

  const uploadedImages = [];
  for (let index = 0; index < 12; index += 1) {
    const result = await upload(owner, new Uint8Array([...png, index]), "image/png");
    assert.equal(result.response.status, 201);
    uploadedImages.push(result.payload.data);
  }
  assert.equal((await upload(owner, png, "image/png")).response.status, 409);
  const reordered = await api(`/v1/listings/${listingId}/images`, {
    ...owner,
    method: "PATCH",
    body: { imageIds: uploadedImages.toReversed().map((image) => image.id) },
  });
  assert.equal(reordered.response.status, 200);
  assert.equal(reordered.payload.data[0].id, uploadedImages.at(-1).id);

  const listingDeleted = await api(`/v1/listings/${listingId}`, {
    ...owner,
    method: "DELETE",
  });
  assert.equal(listingDeleted.response.status, 200);
  assert.equal((await api(`/api/listings/${listingId}`, owner)).response.status, 404);
  assert.equal((await api(`/v1/listings/${listingId}/images`, owner)).response.status, 404);
  assert.equal(
    (
      await fetch(`${baseUrl}${uploadedImages[0].publicUrl}`, {
        headers: headers(owner),
      })
    ).status,
    404,
  );
});

async function signup(label) {
  const session = await auth.session(label);
  const profile = await api("/api/profile", session);
  assert.equal(profile.response.status, 200);
  return session;
}

function listingInput() {
  return {
    categoryId: "test-category",
    subcategoryId: "test-subcategory",
    governorateId: "test-governorate",
    title: "Local integration listing",
    description: "A deterministic local listing",
    price: 500,
    priceType: "fixed",
    condition: "used",
    details: { color: "blue" },
    submit: false,
  };
}

async function upload(session, bytes, type, targetListingId = listingId) {
  const form = new FormData();
  form.set("file", new File([bytes], "upload.bin", { type }));
  const response = await fetch(`${baseUrl}/v1/listings/${targetListingId}/images`, {
    method: "POST",
    headers: headers(session),
    body: form,
  });
  return { response, payload: await response.json() };
}

function headers(session = {}, extra = {}) {
  return {
    Origin: "http://localhost:8080",
    "CF-Connecting-IP": testIp,
    ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    ...extra,
  };
}

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: headers(options, options.body ? { "Content-Type": "application/json" } : {}),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  return { response, payload };
}

async function assignRole(userId, role) {
  const wrangler = fileURLToPath(
    new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url),
  );
  const result = spawnSync(
    process.execPath,
    [
      wrangler,
      "d1",
      "execute",
      "rawaj-staging",
      "--local",
      "--persist-to",
      ".wrangler/test-state-auth",
      "--config",
      "wrangler.generated.jsonc",
      "--command",
      `INSERT OR IGNORE INTO user_roles (user_id, role, created_at) VALUES ('${userId}', '${role}', datetime('now'))`,
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test("owner can read admin metrics", async () => {
  const result = await api("/v1/admin/metrics", owner);
  assert.equal(result.response.status, 200);
  assert.ok(typeof result.payload.data.totalUsers === "number");
});

test("admin can read admin metrics", async () => {
  const result = await api("/v1/admin/metrics", admin);
  assert.equal(result.response.status, 200);
  assert.ok(typeof result.payload.data.totalUsers === "number");
});

test("moderator cannot read admin metrics", async () => {
  const result = await api("/v1/admin/metrics", moderator);
  assert.equal(result.response.status, 403);
});

test("normal user cannot read admin metrics", async () => {
  const result = await api("/v1/admin/metrics", other);
  assert.equal(result.response.status, 403);
});

test("unauthenticated request to admin metrics is rejected", async () => {
  const response = await fetch(`${baseUrl}/v1/admin/metrics`);
  assert.equal(response.status, 401);
});

test("owner can read admin users", async () => {
  const result = await api("/v1/admin/users", owner);
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.payload.data));
});

test("admin cannot read admin users", async () => {
  const result = await api("/v1/admin/users", admin);
  assert.equal(result.response.status, 403);
});

test("owner can read admin audit logs", async () => {
  const result = await api("/v1/admin/audit", owner);
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.payload.data));
});

test("admin can read admin audit logs", async () => {
  const result = await api("/v1/admin/audit", admin);
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.payload.data));
});

test("moderator cannot read admin audit logs", async () => {
  const result = await api("/v1/admin/audit", moderator);
  assert.equal(result.response.status, 403);
});

test("owner can read pending listings", async () => {
  const result = await api("/v1/admin/listings/pending", owner);
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.payload.data));
});

test("admin can read pending listings", async () => {
  const result = await api("/v1/admin/listings/pending", admin);
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.payload.data));
});

test("moderator can read pending listings", async () => {
  const result = await api("/v1/admin/listings/pending", moderator);
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.payload.data));
});

test("normal user cannot read pending listings", async () => {
  const result = await api("/v1/admin/listings/pending", other);
  assert.equal(result.response.status, 403);
});

test("owner can read all listings", async () => {
  const result = await api("/v1/admin/listings", owner);
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.payload.data));
});

test("admin can read all listings", async () => {
  const result = await api("/v1/admin/listings", admin);
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.payload.data));
});

test("moderator can read all listings", async () => {
  const result = await api("/v1/admin/listings", moderator);
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.payload.data));
});

test("normal user cannot read all listings", async () => {
  const result = await api("/v1/admin/listings", other);
  assert.equal(result.response.status, 403);
});

test("owner can approve listing and audit log is created", async () => {
  const listing = await createListing(owner, {
    title: "Admin test listing",
    status: "pending_review",
  });
  assert.equal(listing.response.status, 200);
  const listingId = listing.payload.data.id;

  const moderate = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId,
      action: "approve",
      expectedUpdatedAt: listing.payload.data.updatedAt,
    },
  });
  assert.equal(moderate.response.status, 200);
  assert.equal(moderate.payload.data.previousStatus, "pending_review");
  assert.equal(moderate.payload.data.nextStatus, "approved");

  const audit = await api("/v1/admin/audit", owner);
  assert.equal(audit.response.status, 200);
  const approveLog = audit.payload.data.find(
    (log) => log.targetId === listingId && log.action === "listing_approve",
  );
  assert.ok(approveLog, "approve audit log not found");
  assert.ok(approveLog.metadata && typeof approveLog.metadata === "object");
});

test("moderator can reject listing and audit log is created", async () => {
  const listing = await createListing(owner, {
    title: "Moderator reject test",
    status: "pending_review",
  });
  assert.equal(listing.response.status, 200);
  const listingId = listing.payload.data.id;

  const moderate = await api("/v1/admin/listings/moderate", {
    ...moderator,
    method: "POST",
    body: {
      listingId,
      action: "reject",
      reason: "Invalid listing",
      expectedUpdatedAt: listing.payload.data.updatedAt,
    },
  });
  assert.equal(moderate.response.status, 200);
  assert.equal(moderate.payload.data.previousStatus, "pending_review");
  assert.equal(moderate.payload.data.nextStatus, "rejected");

  const audit = await api("/v1/admin/audit", moderator);
  assert.equal(audit.response.status, 403);
});

test("owner can request_changes on listing", async () => {
  const listing = await createListing(owner, {
    title: "Request changes test",
    status: "pending_review",
  });
  assert.equal(listing.response.status, 200);
  const listingId = listing.payload.data.id;

  const moderate = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId,
      action: "request_changes",
      reason: "Please add more details",
      expectedUpdatedAt: listing.payload.data.updatedAt,
    },
  });
  assert.equal(moderate.response.status, 200);
  assert.equal(moderate.payload.data.previousStatus, "pending_review");
  assert.equal(moderate.payload.data.nextStatus, "rejected");

  const audit = await api("/v1/admin/audit", owner);
  assert.equal(audit.response.status, 200);
  const changesLog = audit.payload.data.find(
    (log) => log.targetId === listingId && log.action === "listing_rejected",
  );
  assert.ok(changesLog, "request_changes audit log not found");
});

test("owner can suspend listing", async () => {
  const listing = await createListing(owner, {
    title: "Suspend test",
    status: "pending_review",
  });
  assert.equal(listing.response.status, 200);
  const listingId = listing.payload.data.id;

  const approved = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId,
      action: "approve",
      expectedUpdatedAt: listing.payload.data.updatedAt,
    },
  });
  assert.equal(approved.response.status, 200);

  const moderate = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId,
      action: "suspend",
      reason: "Policy violation",
      expectedUpdatedAt: approved.payload.data.updatedAt,
    },
  });
  assert.equal(moderate.response.status, 200);
  assert.equal(moderate.payload.data.previousStatus, "approved");
  assert.equal(moderate.payload.data.nextStatus, "archived");

  const audit = await api("/v1/admin/audit", owner);
  assert.equal(audit.response.status, 200);
  const suspendLog = audit.payload.data.find(
    (log) => log.targetId === listingId && log.action === "listing_suspend",
  );
  assert.ok(suspendLog, "suspend audit log not found");
});

test("owner can unpublish listing", async () => {
  const listing = await createListing(owner, {
    title: "Unpublish test",
    status: "pending_review",
  });
  assert.equal(listing.response.status, 200);
  const listingId = listing.payload.data.id;

  const approved = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId,
      action: "approve",
      expectedUpdatedAt: listing.payload.data.updatedAt,
    },
  });
  assert.equal(approved.response.status, 200);

  const moderate = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId,
      action: "unpublish",
      reason: "Content policy",
      expectedUpdatedAt: approved.payload.data.updatedAt,
    },
  });
  assert.equal(moderate.response.status, 200);
  assert.equal(moderate.payload.data.previousStatus, "approved");
  assert.equal(moderate.payload.data.nextStatus, "archived");

  const audit = await api("/v1/admin/audit", owner);
  assert.equal(audit.response.status, 200);
  const unpublishLog = audit.payload.data.find(
    (log) => log.targetId === listingId && log.action === "listing_unpublish",
  );
  assert.ok(unpublishLog, "unpublish audit log not found");
});

test("owner can archive listing", async () => {
  const listing = await createListing(owner, {
    title: "Archive test",
    status: "pending_review",
  });
  assert.equal(listing.response.status, 200);
  const listingId = listing.payload.data.id;

  const approved = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId,
      action: "approve",
      expectedUpdatedAt: listing.payload.data.updatedAt,
    },
  });
  assert.equal(approved.response.status, 200);

  const moderate = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId,
      action: "archive",
      reason: "End of life",
      expectedUpdatedAt: approved.payload.data.updatedAt,
    },
  });
  assert.equal(moderate.response.status, 200);
  assert.equal(moderate.payload.data.previousStatus, "approved");
  assert.equal(moderate.payload.data.nextStatus, "archived");

  const audit = await api("/v1/admin/audit", owner);
  assert.equal(audit.response.status, 200);
  const archiveLog = audit.payload.data.find(
    (log) => log.targetId === listingId && log.action === "listing_archive",
  );
  assert.ok(archiveLog, "archive audit log not found");
});

test("owner can expire_now listing", async () => {
  const listing = await createListing(owner, {
    title: "Expire now test",
    status: "pending_review",
  });
  assert.equal(listing.response.status, 200);
  const listingId = listing.payload.data.id;

  const approved = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId,
      action: "approve",
      expectedUpdatedAt: listing.payload.data.updatedAt,
    },
  });
  assert.equal(approved.response.status, 200);

  const moderate = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId,
      action: "expire_now",
      reason: "Expired by admin",
      expectedUpdatedAt: approved.payload.data.updatedAt,
    },
  });
  assert.equal(moderate.response.status, 200);
  assert.equal(moderate.payload.data.previousStatus, "approved");
  assert.equal(moderate.payload.data.nextStatus, "expired");

  const audit = await api("/v1/admin/audit", owner);
  assert.equal(audit.response.status, 200);
  const expireLog = audit.payload.data.find(
    (log) => log.targetId === listingId && log.action === "listing_expire_now",
  );
  assert.ok(expireLog, "expire_now audit log not found");
});

test("owner can extend_expiry listing", async () => {
  const listing = await createListing(owner, {
    title: "Extend expiry test",
    status: "pending_review",
  });
  assert.equal(listing.response.status, 200);
  const listingId = listing.payload.data.id;

  const approved = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId,
      action: "approve",
      expectedUpdatedAt: listing.payload.data.updatedAt,
    },
  });
  assert.equal(approved.response.status, 200);

  const moderate = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId,
      action: "extend_expiry",
      reason: "Extension granted",
      extendDays: 60,
      expectedUpdatedAt: approved.payload.data.updatedAt,
    },
  });
  assert.equal(moderate.response.status, 200);
  assert.equal(moderate.payload.data.previousStatus, "approved");
  assert.equal(moderate.payload.data.nextStatus, "approved");

  const audit = await api("/v1/admin/audit", owner);
  assert.equal(audit.response.status, 200);
  const extendLog = audit.payload.data.find(
    (log) => log.targetId === listingId && log.action === "listing_extend_expiry",
  );
  assert.ok(extendLog, "extend_expiry audit log not found");
  assert.ok(extendLog.metadata && extendLog.metadata.extendDays === 60);
});

test("normal user cannot moderate listings", async () => {
  const listing = await createListing(owner, {
    title: "Normal user moderation test",
    status: "pending_review",
  });
  assert.equal(listing.response.status, 200);
  const listingId = listing.payload.data.id;

  const moderate = await api("/v1/admin/listings/moderate", {
    ...other,
    method: "POST",
    body: {
      listingId,
      action: "approve",
      expectedUpdatedAt: listing.payload.data.updatedAt,
    },
  });
  assert.equal(moderate.response.status, 403);
});

test("invalid listing ID returns not found", async () => {
  const moderate = await api("/v1/admin/listings/moderate", owner, {
    method: "POST",
    body: {
      listingId: "00000000-0000-0000-0000-000000000000",
      action: "approve",
      expectedUpdatedAt: new Date().toISOString(),
    },
  });
  assert.equal(moderate.response.status, 404);
});

test("unsupported moderation action returns 400 with stable error code", async () => {
  const listing = await createListing(owner, {
    title: "Invalid action test",
    status: "pending_review",
  });
  assert.equal(listing.response.status, 200);

  const moderate = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId: listing.payload.data.id,
      action: "invalid_action",
      expectedUpdatedAt: listing.payload.data.updatedAt,
    },
  });
  assert.equal(moderate.response.status, 400);
  assert.equal(moderate.payload.error.code, "unsupported_moderation_action");
});

test("legacy action names restore and extend are rejected", async () => {
  const listing = await createListing(owner, {
    title: "Legacy action test",
    status: "pending_review",
  });
  assert.equal(listing.response.status, 200);

  const restoreResult = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId: listing.payload.data.id,
      action: "restore",
      expectedUpdatedAt: listing.payload.data.updatedAt,
    },
  });
  assert.equal(restoreResult.response.status, 400);
  assert.equal(restoreResult.payload.error.code, "unsupported_moderation_action");

  const extendResult = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId: listing.payload.data.id,
      action: "extend",
      expectedUpdatedAt: listing.payload.data.updatedAt,
    },
  });
  assert.equal(extendResult.response.status, 400);
  assert.equal(extendResult.payload.error.code, "unsupported_moderation_action");
});

test("stale expectedUpdatedAt is rejected with 409 and stale_review code", async () => {
  const listing = await createListing(owner, {
    title: "Stale review test",
    status: "pending_review",
  });
  assert.equal(listing.response.status, 200);

  const moderate = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId: listing.payload.data.id,
      action: "approve",
      expectedUpdatedAt: "stale-timestamp",
    },
  });
  assert.equal(moderate.response.status, 409);
  assert.equal(moderate.payload.error.code, "stale_review");
});

test("concurrent modification causes stale conflict (zero rows changed)", async () => {
  const listing = await createListing(owner, {
    title: "Concurrent stale test",
    status: "pending_review",
  });
  assert.equal(listing.response.status, 200);
  const listingId = listing.payload.data.id;

  const staleModerate = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId,
      action: "approve",
      expectedUpdatedAt: "stale-timestamp",
    },
  });
  assert.equal(staleModerate.response.status, 409);
  assert.equal(staleModerate.payload.error.code, "stale_review");
});

test("no successful audit action when moderation mutation fails", async () => {
  const listing = await createListing(owner, {
    title: "Failed mutation test",
    status: "pending_review",
  });
  assert.equal(listing.response.status, 200);
  const listingId = listing.payload.data.id;

  const moderate = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId,
      action: "approve",
      expectedUpdatedAt: "stale-timestamp",
    },
  });
  assert.equal(moderate.response.status, 409);

  const audit = await api("/v1/admin/audit", owner);
  assert.equal(audit.response.status, 200);
  const failedAudit = audit.payload.data.find(
    (log) => log.targetId === listingId && log.action === "listing_approve",
  );
  assert.ok(!failedAudit, "audit log should not exist for failed moderation");
});

test("audit metadata is written as valid JSON and read back as object", async () => {
  const listing = await createListing(owner, {
    title: "Audit metadata test",
    status: "pending_review",
  });
  assert.equal(listing.response.status, 200);
  const listingId = listing.payload.data.id;

  const moderate = await api("/v1/admin/listings/moderate", {
    ...owner,
    method: "POST",
    body: {
      listingId,
      action: "reject",
      reason: "Test rejection reason",
      expectedUpdatedAt: listing.payload.data.updatedAt,
    },
  });
  assert.equal(moderate.response.status, 200);

  const audit = await api("/v1/admin/audit", owner);
  assert.equal(audit.response.status, 200);
  const rejectLog = audit.payload.data.find(
    (log) => log.targetId === listingId && log.action === "listing_rejected",
  );
  assert.ok(rejectLog, "reject audit log not found");
  assert.ok(rejectLog.metadata, "metadata should not be null");
  assert.equal(typeof rejectLog.metadata, "object");
  assert.equal(rejectLog.metadata.reason, "Test rejection reason");
});

test("malformed historical audit metadata does not crash the endpoint", async () => {
  const result = await api("/v1/admin/audit", owner);
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.payload.data));
});

test("moderator cannot escalate to owner-only action", async () => {
  const result = await api("/v1/admin/users", moderator);
  assert.equal(result.response.status, 403);
});

async function createListing(session, overrides = {}) {
  const body = {
    categoryId: "test-category",
    subcategoryId: "test-subcategory",
    governorateId: "test-governorate",
    title: "Admin test listing",
    description: "Test listing for admin integration",
    price: 100,
    priceType: "fixed",
    condition: "used",
    details: {},
    submit: false,
    ...overrides,
    status: undefined,
  };
  const draft = await api("/v1/listings", {
    ...session,
    method: "POST",
    body,
  });
  assert.equal(draft.response.status, 201);
  const createdListingId = draft.payload.data.id;
  const taxonomy = await api(`/v1/listings/${createdListingId}/taxonomy`, {
    ...session,
    method: "PUT",
    body: { taxonomyNodeId: "test-taxonomy-leaf" },
  });
  assert.equal(taxonomy.response.status, 200);
  const image = await upload(
    session,
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, Date.now() % 255]),
    "image/png",
    createdListingId,
  );
  assert.equal(image.response.status, 201);
  return api(`/v1/listings/${createdListingId}`, {
    ...session,
    method: "PATCH",
    body: {
      ...body,
      submit: true,
      expectedUpdatedAt: draft.payload.data.updatedAt,
    },
  });
}
