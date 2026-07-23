import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const port = 8791;
const baseUrl = `http://127.0.0.1:${port}`;
const testIp = `198.51.100.${(Date.now() % 200) + 1}`;
let worker;

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
