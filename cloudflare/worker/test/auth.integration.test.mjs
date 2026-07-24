import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createSupabaseAuthFixture } from "./supabase-auth-fixture.mjs";

const port = 8791;
const baseUrl = `http://127.0.0.1:${port}`;
let worker;
let auth;

before(async () => {
  auth = await createSupabaseAuthFixture();
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
      stdio: "ignore",
      windowsHide: true,
    },
  );
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/v1/health`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Local Worker did not become ready.");
});

after(() => worker?.kill());

test("valid Supabase token creates and reuses one D1 identity", async () => {
  const session = await auth.session("identity");
  const first = await request("/api/profile", session.token);
  assert.equal(first.response.status, 200);
  assert.equal(first.payload.data.id, session.userId);
  assert.equal(first.payload.data.email, session.email);
  assert.deepEqual(first.payload.data.roles, ["user"]);

  const second = await request("/api/profile", session.token);
  assert.equal(second.response.status, 200);
  assert.equal(second.payload.data.id, session.userId);
  assert.equal(localIdentityCount(session.userId), 1);
});

test("missing, malformed, expired, wrong issuer, wrong audience, and invalid signatures fail", async () => {
  assert.equal((await request("/api/profile")).response.status, 401);
  assert.equal((await request("/api/profile", "not-a-jwt")).response.status, 401);

  const expired = await auth.session("expired", {
    iat: Math.floor(Date.now() / 1000) - 7200,
    exp: Math.floor(Date.now() / 1000) - 3600,
  });
  assert.equal((await request("/api/profile", expired.token)).response.status, 401);

  const wrongIssuer = await auth.session("issuer", { iss: "https://other.example/auth/v1" });
  assert.equal((await request("/api/profile", wrongIssuer.token)).response.status, 401);

  const wrongAudience = await auth.session("audience", { aud: "anon" });
  assert.equal((await request("/api/profile", wrongAudience.token)).response.status, 401);

  const invalidSignature = await auth.invalidSignatureSession("signature");
  assert.equal((await request("/api/profile", invalidSignature.token)).response.status, 401);
});

test("verified subject overrides body identity and trusted D1 roles override token metadata", async () => {
  const owner = await auth.session("owner");
  const other = await auth.session("other");
  await request("/api/profile", other.token);

  const updated = await request("/api/profile", owner.token, {
    method: "PATCH",
    body: {
      userId: other.userId,
      authUserId: other.userId,
      role: "admin",
      roles: ["admin"],
      displayName: "Verified Owner",
    },
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.data.id, owner.userId);
  assert.deepEqual(updated.payload.data.roles, ["user"]);
});

test("legacy Worker password and session routes are disabled", async () => {
  for (const path of [
    "/v1/auth/signup",
    "/v1/auth/login",
    "/v1/auth/session",
    "/v1/auth/recovery/request",
    "/v1/auth/recovery/complete",
    "/v1/auth/password/change",
  ]) {
    const result = await request(path, undefined, { method: "POST", body: {} });
    assert.ok([404, 405].includes(result.response.status), `${path} must remain disabled`);
  }
});

function localIdentityCount(userId) {
  const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
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
      `SELECT count(*) AS count FROM auth_users
        WHERE auth_provider = 'supabase' AND auth_user_id = '${userId}';`,
      "--json",
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const parsed = JSON.parse(result.stdout);
  return parsed[0].results[0].count;
}

async function request(path, token, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Origin: "http://localhost:8080",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return { response, payload: await response.json() };
}
