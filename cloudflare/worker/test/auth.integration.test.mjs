import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const port = 8791;
const baseUrl = `http://127.0.0.1:${port}`;
const testIp = `198.51.${(process.pid % 200) + 1}.${(Date.now() % 200) + 1}`;
const expiredRecoveryToken = "expired-imported-account-recovery-token";
let worker;

before(async () => {
  seedExpiredRecoveryToken();
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
      const response = await fetch(`${baseUrl}/v1/auth/session`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Local Worker did not become ready.");
});

after(() => {
  worker?.kill();
});

test("signup, session, CSRF rejection, logout, and login lifecycle", async () => {
  const email = `auth-${Date.now()}@example.test`;
  const signup = await request("/v1/auth/signup", {
    method: "POST",
    body: { email, password: "SafePass123!", displayName: "Auth Test" },
  });
  assert.equal(signup.response.status, 201);
  assert.equal(signup.payload.data.session.user.email, email);
  assert.equal(signup.payload.data.session.user.emailConfirmed, true);
  assert.equal("requiresEmailConfirmation" in signup.payload.data, false);
  assert.ok(signup.payload.data.session.csrfToken);
  assert.match(signup.cookies, /rawaj_session=/);
  assert.match(signup.cookies, /HttpOnly/);

  const session = await request("/v1/auth/session", { cookie: signup.cookieHeader });
  assert.equal(session.response.status, 200);
  assert.equal(session.payload.data.session.user.email, email);

  const missingCsrf = await request("/v1/auth/logout", {
    method: "POST",
    body: {},
    cookie: signup.cookieHeader,
  });
  assert.equal(missingCsrf.response.status, 403);
  assert.equal(missingCsrf.payload.error.code, "csrf_rejected");

  const logout = await request("/v1/auth/logout", {
    method: "POST",
    body: {},
    cookie: signup.cookieHeader,
    csrf: signup.payload.data.session.csrfToken,
  });
  assert.equal(logout.response.status, 200);

  const invalidLogin = await request("/v1/auth/login", {
    method: "POST",
    body: { email, password: "WrongPass123!" },
  });
  assert.equal(invalidLogin.response.status, 401);

  const login = await request("/v1/auth/login", {
    method: "POST",
    body: { email, password: "SafePass123!" },
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.payload.data.session.user.email, email);

  const duplicate = await request("/v1/auth/signup", {
    method: "POST",
    body: { email: email.toUpperCase(), password: "SafePass123!", displayName: "Duplicate" },
  });
  assert.equal(duplicate.response.status, 409);
});

test("validates content type, JSON shape, email, and password", async () => {
  const unsupported = await fetch(`${baseUrl}/v1/auth/signup`, {
    method: "POST",
    headers: { "CF-Connecting-IP": testIp },
    body: "{}",
  });
  assert.equal(unsupported.status, 415);

  const malformed = await fetch(`${baseUrl}/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": testIp },
    body: "{",
  });
  assert.equal(malformed.status, 400);

  const invalid = await request("/v1/auth/signup", {
    method: "POST",
    body: { email: "bad", password: "weak", displayName: "X" },
  });
  assert.equal(invalid.response.status, 400);
});

test("imported account recovery is private, expiring, single-use, and preserves ownership", async () => {
  const importedLogin = await request("/v1/auth/login", {
    method: "POST",
    body: { email: "imported-seller@example.test", password: "UnknownPass123!" },
  });
  assert.equal(importedLogin.response.status, 403);
  assert.equal(importedLogin.payload.error.code, "account_recovery_required");

  const missing = await request("/v1/auth/recovery/request", {
    method: "POST",
    body: { email: "absent-account@example.test" },
  });
  assert.equal(missing.response.status, 202);
  assert.equal(missing.payload.data.accepted, true);
  assert.equal("developmentToken" in missing.payload.data, false);

  const requested = await request("/v1/auth/recovery/request", {
    method: "POST",
    body: { email: "IMPORTED-SELLER@example.test" },
  });
  assert.equal(requested.response.status, 202);
  assert.ok(requested.payload.data.developmentToken);

  const invalid = await request("/v1/auth/recovery/complete", {
    method: "POST",
    body: { token: "invalid-recovery-token", password: "RecoveredPass123!" },
  });
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.payload.error.code, "invalid_token");

  const weak = await request("/v1/auth/recovery/complete", {
    method: "POST",
    body: { token: requested.payload.data.developmentToken, password: "weak" },
  });
  assert.equal(weak.response.status, 400);

  const completed = await request("/v1/auth/recovery/complete", {
    method: "POST",
    body: { token: requested.payload.data.developmentToken, password: "RecoveredPass123!" },
  });
  assert.equal(completed.response.status, 200);

  const replay = await request("/v1/auth/recovery/complete", {
    method: "POST",
    body: { token: requested.payload.data.developmentToken, password: "AnotherPass123!" },
  });
  assert.equal(replay.response.status, 400);
  assert.equal(replay.payload.error.code, "invalid_token");

  const login = await request("/v1/auth/login", {
    method: "POST",
    body: { email: "imported-seller@example.test", password: "RecoveredPass123!" },
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.payload.data.session.user.id, "test-public-seller");

  const owned = await request("/v1/account/listings", { cookie: login.cookieHeader });
  assert.equal(owned.response.status, 200);
  assert.ok(
    (owned.payload.data ?? []).some((listing) => listing.id === "test-public-listing"),
    "recovered account must retain its existing listing",
  );

  const expired = await request("/v1/auth/recovery/complete", {
    method: "POST",
    body: { token: expiredRecoveryToken, password: "ExpiredPass123!" },
  });
  assert.equal(expired.response.status, 400);
  assert.equal(expired.payload.error.code, "invalid_token");
});

function seedExpiredRecoveryToken() {
  const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
  const tokenHash = createHash("sha256").update(expiredRecoveryToken).digest("base64url");
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
      `INSERT OR REPLACE INTO auth_one_time_tokens
       (id, user_id, purpose, token_hash, payload, created_at, expires_at, consumed_at)
       VALUES ('expired-recovery-fixture', 'test-public-seller', 'password_reset',
         '${tokenHash}', '{}', '1999-01-01T00:00:00.000Z', '2000-01-01T00:00:00.000Z', NULL);`,
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
}


async function request(path, options = {}) {
  const headers = {
    Origin: "http://localhost:8080",
    "CF-Connecting-IP": testIp,
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.cookie ? { Cookie: options.cookie } : {}),
    ...(options.csrf ? { "X-CSRF-Token": options.csrf } : {}),
  };
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  const getSetCookie = response.headers.getSetCookie?.() ?? [];
  const cookies = getSetCookie.join("\n");
  const cookieHeader = getSetCookie.map((value) => value.split(";", 1)[0]).join("; ");
  return { response, payload, cookies, cookieHeader };
}
