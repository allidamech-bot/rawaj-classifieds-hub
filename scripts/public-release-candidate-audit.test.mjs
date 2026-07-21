import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [auditSource, workflowSource] = await Promise.all([
  readFile(new URL("./audit-public-release-candidate.mjs", import.meta.url), "utf8"),
  readFile(
    new URL("../.github/workflows/public-release-candidate-audit.yml", import.meta.url),
    "utf8",
  ),
]);

test("public release audit remains manual and read-only", () => {
  assert.match(workflowSource, /on:\s*\n\s*workflow_dispatch:/);
  assert.doesNotMatch(workflowSource, /\n\s{2}push:/);
  assert.doesNotMatch(workflowSource, /\n\s{2}pull_request:/);
  assert.match(workflowSource, /permissions:\s*\n\s*contents: read/);
  assert.match(workflowSource, /node scripts\/audit-public-release-candidate\.mjs/);
  assert.doesNotMatch(workflowSource, /secrets\./);
  assert.doesNotMatch(workflowSource, /deploy_to_vercel|vercel promote|supabase db push/i);

  for (const mutationMarker of [
    'method: "POST"',
    'method: "PUT"',
    'method: "PATCH"',
    'method: "DELETE"',
  ]) {
    assert.ok(!auditSource.includes(mutationMarker), `Audit must remain read-only: ${mutationMarker}`);
  }
  assert.match(auditSource, /method: "GET"/);
  assert.match(auditSource, /redirect: "manual"/);
});

test("public release audit is restricted to canonical and Vercel hosts", () => {
  assert.match(auditSource, /hostname === "rawa-j\.com"/);
  assert.match(auditSource, /hostname === "www\.rawa-j\.com"/);
  assert.match(auditSource, /hostname\.endsWith\("\.vercel\.app"\)/);
  assert.match(auditSource, /Release audit requires HTTPS/);
  assert.match(auditSource, /Credentials are not allowed in the audit URL/);
  assert.match(auditSource, /must contain only the origin/);
});

test("public route and deployment truth coverage stays complete", () => {
  for (const route of [
    "/",
    "/categories",
    "/listings",
    "/offers",
    "/login",
    "/reset-password",
    "/support",
    "/safety",
    "/prohibited",
    "/privacy",
    "/terms",
    "/robots.txt",
    "/sitemap.xml",
    "/.well-known/assetlinks.json",
  ]) {
    assert.ok(auditSource.includes(`"${route}"`), `Missing release route ${route}`);
  }

  assert.match(auditSource, /x-rawaj-build-commit/);
  assert.match(auditSource, /rawaj-build-commit/);
  assert.match(auditSource, /build commit mismatch/);
  assert.match(auditSource, /x-content-type-options/);
  assert.match(auditSource, /x-frame-options/);
  assert.match(auditSource, /content-security-policy/);
  assert.match(auditSource, /referrer-policy/);
  assert.match(auditSource, /cache-control: no-store/);
});

test("Digital Asset Links accepts only configured release identity or fail-closed 503", () => {
  assert.match(auditSource, /android_app_links_not_configured/);
  assert.match(auditSource, /com\.rawaj\.marketplace/);
  assert.match(auditSource, /delegate_permission\/common\.handle_all_urls/);
  assert.match(auditSource, /sha256_cert_fingerprints/);
  assert.match(auditSource, /\(\?:\[0-9A-F\]\{2\}:\)\{31\}/);
  assert.match(workflowSource, /require_configured_app_links/);
  assert.match(workflowSource, /RAWAJ_ALLOW_ASSETLINKS_503/);
});
