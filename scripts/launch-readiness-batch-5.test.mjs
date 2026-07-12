import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const [
  serverSource,
  authReturnSource,
  storageSource,
  publicSecuritySource,
  packageJson,
  qualityGate,
] = await Promise.all([
  readFile(new URL("../src/server.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/auth-return.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/storage.ts", import.meta.url), "utf8"),
  readFile(new URL("./public-data-security.test.mjs", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

const transpiledAuthReturn = ts.transpileModule(authReturnSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { sanitizeAuthReturnTo } = await import(
  `data:text/javascript;base64,${Buffer.from(transpiledAuthReturn).toString("base64")}`
);

test("production CSP removes eval and constrains executable and embedding surfaces", () => {
  assert.ok(serverSource.includes("script-src 'self' 'unsafe-inline'"));
  assert.ok(!serverSource.includes("'unsafe-eval'"));
  for (const directive of [
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ]) {
    assert.ok(serverSource.includes(directive), `Missing CSP directive: ${directive}`);
  }
});

test("HTTPS responses receive transport and cross-origin hardening", () => {
  assert.ok(serverSource.includes('url.protocol === "https:"'));
  assert.ok(
    serverSource.includes(
      'headers.set("strict-transport-security", "max-age=31536000; includeSubDomains; preload")',
    ),
  );
  assert.ok(
    serverSource.includes('headers.set("cross-origin-opener-policy", "same-origin-allow-popups")'),
  );
  assert.ok(serverSource.includes('headers.set("cross-origin-resource-policy", "same-site")'));
  assert.ok(serverSource.includes('headers.set("x-permitted-cross-domain-policies", "none")'));
  assert.ok(
    serverSource.includes('if (isSecureRequest) directives.push("upgrade-insecure-requests")'),
  );
});

test("authentication and recovery pages are never cacheable", () => {
  assert.ok(serverSource.includes('["/auth/callback", "/login", "/reset-password"]'));
  assert.ok(serverSource.includes('headers.set("cache-control", "no-store, max-age=0")'));
  assert.ok(serverSource.includes('headers.set("pragma", "no-cache")'));
  assert.ok(serverSource.includes('headers.set("expires", "0")'));
  assert.ok(serverSource.includes("normalizeCatastrophicSsrResponse(response, request)"));
});

test("auth return URLs stay same-origin and avoid authentication loops", () => {
  for (const unsafeValue of [
    "https://evil.example/steal",
    "//evil.example/steal",
    "javascript:alert(1)",
    "/auth/callback?next=/profile",
    "/login",
    "/reset-password",
  ]) {
    assert.equal(sanitizeAuthReturnTo(unsafeValue, "/more"), "/more");
  }
  assert.equal(
    sanitizeAuthReturnTo("/profile/listings?q=test#top", "/more"),
    "/profile/listings?q=test#top",
  );
});

test("file uploads require allowed MIME, extension, and bounded size before storage", () => {
  assert.ok(storageSource.includes("validateImageMimeType(file.type)"));
  assert.ok(storageSource.includes("validateImageExtension(file.name)"));
  assert.ok(storageSource.includes("file.size > MAX_IMAGE_SIZE_BYTES"));
  assert.ok(storageSource.includes("validateReceiptMimeType(file.type)"));
  assert.ok(storageSource.includes("validateReceiptExtension(file.name)"));
  assert.ok(storageSource.includes("file.size > MAX_RECEIPT_SIZE_BYTES"));
  assert.ok(storageSource.includes("crypto.randomUUID()"));
});

test("existing public data and JSON-LD security regression remains active", () => {
  assert.ok(
    publicSecuritySource.includes("JSON-LD serialization neutralizes script-breaking characters"),
  );
  assert.ok(
    publicSecuritySource.includes("public listing allowlist excludes moderation-only fields"),
  );
  assert.ok(qualityGate.includes("Public data security contract"));
  assert.ok(qualityGate.includes("Admin security regression contract"));
});

test("Batch 5 security contract is wired into local and GitHub gates", () => {
  const parsed = JSON.parse(packageJson);
  assert.ok(parsed.scripts["test:launch-readiness-batch-5"]);
  assert.ok(parsed.scripts.check.includes("test:launch-readiness-batch-5"));
  assert.ok(qualityGate.includes("Launch readiness Batch 5 contract"));
  assert.ok(qualityGate.includes("npm run test:launch-readiness-batch-5"));
});
