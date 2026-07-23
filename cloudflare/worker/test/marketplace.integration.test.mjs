import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const port = 8792;
const baseUrl = `http://127.0.0.1:${port}`;
const testIp = `203.0.113.${(Date.now() % 200) + 1}`;
let worker;
let owner;
let other;
let listingId;
let imageId;

before(async () => {
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
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      stdio: "ignore",
      windowsHide: true,
    },
  );
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/v1/auth/session`)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  owner = await signup("owner");
  other = await signup("other");
});

after(() => worker?.kill());

test("profile access, validation, CSRF, and immutable identity", async () => {
  assert.equal((await api("/api/profile")).response.status, 401);

  const read = await api("/api/profile", owner);
  assert.equal(read.response.status, 200);
  assert.equal(read.payload.data.id, owner.userId);

  const noCsrf = await api("/api/profile", {
    ...owner,
    method: "PATCH",
    body: { displayName: "Updated Owner" },
    csrf: undefined,
  });
  assert.equal(noCsrf.response.status, 403);

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

test("listing creation security, reads, filtering, ownership, and deletion", async () => {
  const input = listingInput();
  assert.equal((await api("/v1/listings", { method: "POST", body: input })).response.status, 401);
  assert.equal(
    (
      await api("/v1/listings", {
        ...owner,
        method: "POST",
        body: input,
        csrf: undefined,
      })
    ).response.status,
    403,
  );
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
  assert.equal(ownerRead.payload.data.listing.owner_id, owner.userId);

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
  assert.equal(afterUpdate.payload.data.listing.owner_id, owner.userId);
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

  const listed = await api(`/v1/listings/${listingId}/images`);
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
  assert.equal((await api(`/v1/listings/${listingId}/images`)).payload.data.length, 0);

  const uploadedImages = [];
  for (let index = 0; index < 12; index += 1) {
    const result = await upload(owner, png, "image/png");
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
  assert.equal((await api(`/v1/listings/${listingId}/images`)).payload.data.length, 0);
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
  const result = await api("/v1/auth/signup", {
    method: "POST",
    body: {
      email: `${label}-${Date.now()}-${crypto.randomUUID()}@example.test`,
      password: "SafePass123!",
      displayName: `${label} user`,
    },
  });
  assert.equal(result.response.status, 201);
  return {
    cookie: result.cookie,
    csrf: result.payload.data.session.csrfToken,
    userId: result.payload.data.session.user.id,
  };
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

async function upload(session, bytes, type) {
  const form = new FormData();
  form.set("file", new File([bytes], "upload.bin", { type }));
  const response = await fetch(`${baseUrl}/v1/listings/${listingId}/images`, {
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
    ...(session.cookie ? { Cookie: session.cookie } : {}),
    ...(session.csrf ? { "X-CSRF-Token": session.csrf } : {}),
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
  const setCookies = response.headers.getSetCookie?.() ?? [];
  return {
    response,
    payload,
    cookie: setCookies.map((value) => value.split(";", 1)[0]).join("; "),
  };
}
