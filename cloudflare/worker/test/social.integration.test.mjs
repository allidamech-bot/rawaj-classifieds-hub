import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const workerDir = fileURLToPath(new URL("..", import.meta.url));
const wrangler = fileURLToPath(
  new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url),
);
const port = 8793;
const baseUrl = `http://127.0.0.1:${port}`;
const testIp = `192.0.${(process.pid % 200) + 1}.${(Date.now() % 200) + 1}`;
let worker;
let owner;
let buyer;
let outsider;
let conversationId;
let savedSearchId;

before(async () => {
  worker = spawn(
    process.execPath,
    [
      wrangler,
      "dev",
      "--config",
      "wrangler.generated.jsonc",
      "--local",
      "--persist-to",
      ".wrangler/test-state-auth",
      "--port",
      String(port),
    ],
    { cwd: workerDir, stdio: "ignore", windowsHide: true },
  );
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/v1/auth/session`)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  owner = await signup("social-owner");
  buyer = await signup("social-buyer");
  outsider = await signup("social-outsider");
  const listing = await api("/v1/listings", {
    ...owner,
    method: "POST",
    body: listingInput(),
  });
  assert.equal(listing.response.status, 201);
  owner.listingId = listing.payload.data.id;
  executeLocalSql(
    `UPDATE listings SET status = 'approved', published_at = '2026-01-01T00:00:00.000Z' WHERE id = '${owner.listingId}'`,
  );
  await waitForWorker();
});

after(() => worker?.kill());

test("favorites are authenticated, idempotent, isolated, and public-only", async () => {
  assert.equal((await api("/v1/listings/test-public-listing/favorite")).response.status, 401);
  assert.equal(
    (
      await api("/v1/listings/test-public-listing/favorite", {
        ...buyer,
        method: "POST",
        csrf: undefined,
        body: {},
      })
    ).response.status,
    403,
  );
  const first = await api("/v1/listings/test-public-listing/favorite", {
    ...buyer,
    method: "POST",
    body: {},
  });
  const duplicate = await api("/v1/listings/test-public-listing/favorite", {
    ...buyer,
    method: "POST",
    body: {},
  });
  assert.equal(first.response.status, 200);
  assert.equal(duplicate.response.status, 200);
  assert.equal(
    (await api("/v1/listings/test-public-listing/favorite", buyer)).payload.data.favorited,
    true,
  );
  const favorites = await api("/v1/account/favorites", buyer);
  assert.equal(favorites.response.status, 200);
  assert.equal(
    favorites.payload.data.filter((item) => item.listing_id === "test-public-listing").length,
    1,
  );
  assert.equal((await api("/v1/account/favorites", outsider)).payload.data.length, 0);
  const draft = await api("/v1/listings", {
    ...owner,
    method: "POST",
    body: { ...listingInput(), title: "Private favorite draft" },
  });
  assert.equal(draft.response.status, 201);
  assert.equal(
    (
      await api(`/v1/listings/${draft.payload.data.id}/favorite`, {
        ...buyer,
        method: "POST",
        body: {},
      })
    ).response.status,
    404,
  );
  assert.equal(
    (
      await api("/v1/listings/test-public-listing/favorite", {
        ...buyer,
        method: "DELETE",
      })
    ).response.status,
    200,
  );
  assert.equal(
    (
      await api("/v1/listings/test-public-listing/favorite", {
        ...buyer,
        method: "DELETE",
      })
    ).response.status,
    200,
  );
});

test("saved searches validate schema and enforce ownership", async () => {
  assert.equal((await api("/v1/account/saved-searches")).response.status, 401);
  assert.equal(
    (
      await api("/v1/account/saved-searches", {
        ...buyer,
        method: "POST",
        csrf: undefined,
        body: validSearch(),
      })
    ).response.status,
    403,
  );
  assert.equal(
    (
      await api("/v1/account/saved-searches", {
        ...buyer,
        method: "POST",
        body: { ...validSearch(), filters: { unsafeSql: "DROP" } },
      })
    ).response.status,
    400,
  );
  assert.equal(
    (
      await api("/v1/account/saved-searches", {
        ...buyer,
        method: "POST",
        body: { ...validSearch(), filters: { priceMin: -1 } },
      })
    ).response.status,
    400,
  );
  assert.equal(
    (
      await api("/v1/account/saved-searches", {
        ...buyer,
        method: "POST",
        body: { ...validSearch(), filters: { query: "x".repeat(9000) } },
      })
    ).response.status,
    400,
  );
  const created = await api("/v1/account/saved-searches", {
    ...buyer,
    method: "POST",
    body: validSearch(),
  });
  assert.equal(created.response.status, 201);
  savedSearchId = created.payload.data.id;
  const list = await api("/v1/account/saved-searches", buyer);
  assert.equal(list.response.status, 200);
  assert.ok(list.payload.data.some((item) => item.id === savedSearchId));
  assert.equal(
    (
      await api(`/v1/account/saved-searches/${savedSearchId}`, {
        ...outsider,
        method: "PATCH",
        body: { alertFrequency: "off" },
      })
    ).response.status,
    404,
  );
  const updated = await api(`/v1/account/saved-searches/${savedSearchId}`, {
    ...buyer,
    method: "PATCH",
    body: { alertFrequency: "daily" },
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.data.alertFrequency, "daily");
  assert.equal(
    (
      await api(`/v1/account/saved-searches/${savedSearchId}`, {
        ...outsider,
        method: "DELETE",
      })
    ).response.status,
    404,
  );
  assert.equal(
    (
      await api(`/v1/account/saved-searches/${savedSearchId}`, {
        ...buyer,
        method: "DELETE",
      })
    ).response.status,
    200,
  );
});

test("conversations enforce identity, idempotency, messaging, unread, and pagination", async () => {
  assert.equal((await api("/v1/account/conversations")).response.status, 401);
  assert.equal(
    (
      await api("/v1/conversations", {
        ...owner,
        method: "POST",
        body: { listingId: owner.listingId },
      })
    ).response.status,
    409,
  );
  assert.equal(
    (
      await api("/v1/conversations", {
        ...buyer,
        method: "POST",
        body: { listingId: "missing-listing" },
      })
    ).response.status,
    404,
  );
  const created = await api("/v1/conversations", {
    ...buyer,
    method: "POST",
    body: { listingId: owner.listingId },
  });
  const duplicate = await api("/v1/conversations", {
    ...buyer,
    method: "POST",
    body: { listingId: owner.listingId },
  });
  assert.ok([200, 201].includes(created.response.status));
  assert.ok([200, 201].includes(duplicate.response.status));
  conversationId = created.payload.data.id;
  assert.equal(duplicate.payload.data.id, conversationId);

  const conversations = await api("/v1/account/conversations?page=1&pageSize=1", buyer);
  assert.equal(conversations.response.status, 200);
  assert.equal(conversations.payload.data.items.length, 1);
  assert.equal((await api(`/v1/conversations/${conversationId}`, outsider)).response.status, 404);
  assert.equal(
    (
      await api(`/v1/conversations/${conversationId}/messages`, {
        ...buyer,
        method: "POST",
        csrf: undefined,
        body: { body: "hello", requestId: crypto.randomUUID() },
      })
    ).response.status,
    403,
  );
  for (const body of ["", " ".repeat(3), "x".repeat(2001)]) {
    assert.equal(
      (
        await api(`/v1/conversations/${conversationId}/messages`, {
          ...buyer,
          method: "POST",
          body: { body, requestId: crypto.randomUUID() },
        })
      ).response.status,
      400,
    );
  }
  assert.equal(
    (
      await api(`/v1/conversations/${conversationId}/messages`, {
        ...outsider,
        method: "POST",
        body: { body: "intrusion", requestId: crypto.randomUUID() },
      })
    ).response.status,
    404,
  );
  const requestId = crypto.randomUUID();
  const sent = await api(`/v1/conversations/${conversationId}/messages`, {
    ...buyer,
    method: "POST",
    body: { body: "First local message", requestId },
  });
  const retried = await api(`/v1/conversations/${conversationId}/messages`, {
    ...buyer,
    method: "POST",
    body: { body: "First local message", requestId },
  });
  assert.equal(sent.response.status, 201);
  assert.equal(retried.payload.data.id, sent.payload.data.id);
  await api(`/v1/conversations/${conversationId}/messages`, {
    ...owner,
    method: "POST",
    body: { body: "Reply from seller", requestId: crypto.randomUUID() },
  });
  const page = await api(`/v1/conversations/${conversationId}/messages?page=1&pageSize=1`, buyer);
  assert.equal(page.response.status, 200);
  assert.equal(page.payload.data.items.length, 1);
  const all = await api(`/v1/conversations/${conversationId}/messages?page=1&pageSize=10`, buyer);
  assert.equal(all.payload.data.items.length, 2);
  assert.ok(all.payload.data.items[0].created_at <= all.payload.data.items[1].created_at);
  assert.equal((await api("/v1/account/messages/unread-count", buyer)).payload.data.count, 1);
  assert.equal(
    (
      await api(`/v1/conversations/${conversationId}/read`, {
        ...buyer,
        method: "POST",
        body: {},
      })
    ).response.status,
    200,
  );
  assert.equal((await api("/v1/account/messages/unread-count", buyer)).payload.data.count, 0);
  assert.equal((await api("/v1/account/messages/unread-count", outsider)).payload.data.count, 0);
});

async function signup(label) {
  const result = await api("/v1/auth/signup", {
    method: "POST",
    body: {
      email: `${label}-${Date.now()}-${crypto.randomUUID()}@example.test`,
      password: "SafePass123!",
      displayName: label,
    },
  });
  assert.equal(result.response.status, 201);
  return {
    cookie: result.cookie,
    csrf: result.payload.data.session.csrfToken,
    userId: result.payload.data.session.user.id,
  };
}

function validSearch() {
  return {
    nameAr: "سيارات دمشق",
    filters: {
      categoryId: "test-category",
      governorateId: "test-governorate",
      priceMin: 100,
      sort: "latest",
    },
    alertFrequency: "weekly",
  };
}

function listingInput() {
  return {
    categoryId: "test-category",
    subcategoryId: "test-subcategory",
    governorateId: "test-governorate",
    title: "Messaging integration listing",
    description: "Listing used by local messaging tests",
    price: 500,
    priceType: "fixed",
    condition: "used",
    details: {},
    submit: false,
  };
}

function executeLocalSql(sql) {
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
      sql,
    ],
    { cwd: workerDir, encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

async function waitForWorker() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/v1/auth/session`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Local Worker did not recover after the fixture update.");
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
