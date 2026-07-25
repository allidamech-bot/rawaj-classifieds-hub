import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("verification frontend is Cloudflare and private R2 only", async () => {
  const source = await read("src/lib/api/verification.ts");
  assert.doesNotMatch(source, /@supabase|\bgetClient\b|\.rpc\(|\.storage|client\.from\(/);
  assert.match(source, /\/v1\/account\/verifications/);
  assert.match(source, /cloudflareAuthorizedFetch/);
});

test("verification Worker validates content and never exposes a public document URL", async () => {
  const worker = await read("cloudflare/worker/src/verification.ts");
  assert.match(worker, /matchesDocumentSignature/);
  assert.match(worker, /env\.MEDIA\.put/);
  assert.match(worker, /private, no-store/);
  assert.doesNotMatch(worker, /getPublicUrl|public, max-age/);
});

test("verification decisions are authorization and optimistic-concurrency gated", async () => {
  const worker = await read("cloudflare/worker/src/verification.ts");
  assert.match(worker, /canManage\(auth\.roles\)/);
  assert.match(worker, /expectedUpdatedAt/);
  assert.match(worker, /status = 'pending_review'/);
  assert.match(worker, /verification_status = \?/);
});

test("D1 enforces one pending request and document ownership", async () => {
  const migration = await read("cloudflare/d1/migrations/0009_verification_requests.sql");
  assert.match(migration, /idx_verification_one_pending_per_user/);
  assert.match(migration, /FOREIGN KEY \(document_asset_id\) REFERENCES media_assets/);
  assert.match(migration, /UNIQUE \(user_id, client_request_id\)/);
});

test("entry routes verification before the generic admin fallback", async () => {
  const entry = await read("cloudflare/worker/src/entry.ts");
  const verification = entry.indexOf("handleVerification(request, env)");
  const genericAdmin = entry.indexOf("handleAdmin(request, env)");
  assert.ok(verification >= 0 && genericAdmin >= 0 && verification < genericAdmin);
});
