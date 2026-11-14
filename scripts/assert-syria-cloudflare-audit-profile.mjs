#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const expectedMainRelease = "d6fefcecc50e4f9b86a6961896e7f0cd51163374";
const profile = process.argv[2] ?? "all";
const allowedProfiles = new Set([
  "all",
  "availability",
  "identity",
  "current-release",
  "controls",
  "cors-canonical",
  "cors-security",
  "cors-reject-saudi",
  "cors-reject-random",
]);
if (!allowedProfiles.has(profile)) {
  console.error(`Unsupported Syria Cloudflare audit profile: ${profile}`);
  process.exit(2);
}

const probe = spawnSync(process.execPath, ["scripts/audit-syria-cloudflare-public-live.mjs"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});
if (probe.error) throw probe.error;
if (probe.status !== 0) process.exit(probe.status ?? 1);

const report = JSON.parse(readFileSync("public/audits/syria-cloudflare-public-live.json", "utf8"));
const failures = Array.isArray(report.failedChecks) ? report.failedChecks : [];
const selectors = {
  availability: [
    "health.http200",
    "health.databaseReady",
    "health-www.http200",
    "system-status.http200",
    "public-listings.http200",
    "public-references.http200",
    "public-references.categoriesAvailable",
    "public-references.governoratesAvailable",
    "profile-preflight.http204",
  ],
  identity: [
    "health.SyrianServiceIdentity",
    "health.productionEnvironment",
    "health.releaseShaPresent",
    "health.SyrianCountryIdentity",
  ],
  controls: [
    "system-status.maintenanceDisabled",
    "system-status.emergencyReadOnlyDisabled",
    "system-status.listingFreezeDisabled",
  ],
  "cors-canonical": [
    "health.canonicalCors",
    "health-www.canonicalWwwCors",
    "public-listings.canonicalWwwCors",
    "public-references.canonicalCors",
    "profile-preflight.canonicalCors",
  ],
  "cors-security": [
    "health.credentialsNotEnabled",
    "health.requestIdValid",
    "health.nosniff",
    "health.noReferrer",
    "public-listings.cacheHeaderPresent",
    "profile-preflight.credentialsNotEnabled",
    "profile-preflight.authorizationAllowed",
    "profile-preflight.idempotencyAllowed",
    "profile-preflight.ifNoneMatchAllowed",
  ],
  "cors-reject-saudi": [
    "reject-saudi-origin.endpointReachable",
    "reject-saudi-origin.SaudiOriginNotAuthorized",
  ],
  "cors-reject-random": [
    "reject-random-origin.endpointReachable",
    "reject-random-origin.randomOriginNotAuthorized",
  ],
};

if (profile === "current-release") {
  const healthProbe = Array.isArray(report.probes)
    ? report.probes.find((candidate) => candidate?.name === "health")
    : null;
  const liveRelease = healthProbe?.summary?.releaseSha ?? null;
  const matches = liveRelease === expectedMainRelease;
  console.log(`Syria Cloudflare live profile current-release: ${matches ? "PASS" : "FAIL"}`);
  console.log(`EXPECTED_RELEASE=${expectedMainRelease}`);
  console.log(`LIVE_RELEASE=${liveRelease ?? "missing"}`);
  if (!matches) process.exit(1);
  process.exit(0);
}

const selected = profile === "all" ? Object.values(selectors).flat() : selectors[profile];
const selectedFailures = [...new Set(selected)].filter((name) => failures.includes(name));

console.log(`Syria Cloudflare live profile ${profile}: ${selectedFailures.length ? "FAIL" : "PASS"}`);
for (const failure of selectedFailures) console.error(`FAILED_CHECK=${failure}`);
if (selectedFailures.length > 0) process.exit(1);
