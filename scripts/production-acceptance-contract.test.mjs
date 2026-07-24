import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  workflow,
  spec,
  stagingWorkflow,
  stagingSpec,
  packageSource,
  qualityGate,
  linking,
  serverSource,
  capacitorConfig,
  androidManifest,
  androidStrings,
  authSource,
  loginSource,
  envExample,
  linkingRunbook,
] = await Promise.all([
  readFile(new URL("../.github/workflows/production-acceptance.yml", import.meta.url), "utf8"),
  readFile(new URL("../e2e/production-acceptance.spec.ts", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/staging-write-acceptance.yml", import.meta.url), "utf8"),
  readFile(new URL("../e2e/staging-write-acceptance.spec.ts", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/production-linking.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/server.ts", import.meta.url), "utf8"),
  readFile(new URL("../capacitor.config.ts", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/res/values/strings.xml", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/auth.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/login.tsx", import.meta.url), "utf8"),
  readFile(new URL("../.env.example", import.meta.url), "utf8"),
  readFile(new URL("../docs/production-auth-app-links.md", import.meta.url), "utf8"),
]);

test("production acceptance is manual-only and uses dedicated secrets", () => {
  assert.match(workflow, /on:\s*\n\s*workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s{2}push:/);
  assert.doesNotMatch(workflow, /\n\s{2}pull_request:/);
  assert.match(workflow, /secrets\.RAWAJ_ACCEPTANCE_EMAIL/);
  assert.match(workflow, /secrets\.RAWAJ_ACCEPTANCE_PASSWORD/);
  assert.match(workflow, /Validate dedicated acceptance credentials/);
  assert.match(workflow, /E2E_BASE_URL:\s*https:\/\/rawa-j\.com/);
  assert.match(workflow, /EXPECTED_COMMIT_SHA/);
  assert.match(workflow, /production-acceptance\.spec\.ts/);
  assert.match(workflow, /--project=mobile-chromium --workers=1/);
});

test("authenticated production acceptance remains read-only", () => {
  for (const path of [
    "/profile",
    "/profile/listings",
    "/add-listing",
    "/favorites",
    "/saved-searches",
    "/chats",
    "/notifications",
    "/promotion",
  ]) {
    assert.ok(spec.includes(`"${path}"`), `Missing authenticated acceptance route ${path}`);
  }

  assert.ok(spec.includes(`input[type="email"]`));
  assert.ok(spec.includes(`input[autocomplete="current-password"]`));
  assert.match(spec, /rawaj-build-commit/);
  assert.match(spec, /page\.on\("pageerror"/);
  assert.match(spec, /page\.on\("console"/);
  assert.match(spec, /page\.on\("requestfailed"/);

  for (const mutationMarker of [
    "request.post(",
    "request.put(",
    "request.patch(",
    "request.delete(",
    `input[type="file"]`,
    "createOwnerDraftListing",
    "submitOwnerListingForReview",
    "إرسال للمراجعة",
    "Submit for review",
  ]) {
    assert.ok(
      !spec.includes(mutationMarker),
      `Production acceptance must remain read-only: ${mutationMarker}`,
    );
  }
});

test("destructive acceptance is isolated to a manual staging-only workflow", () => {
  assert.match(stagingWorkflow, /on:\s*\n\s*workflow_dispatch:/);
  assert.doesNotMatch(stagingWorkflow, /\n\s{2}push:/);
  assert.doesNotMatch(stagingWorkflow, /\n\s{2}pull_request:/);
  assert.match(stagingWorkflow, /environment:\s*rawaj-staging/);
  assert.match(stagingWorkflow, /RAWAJ_STAGING_WRITE_ACCEPTANCE:\s*"1"/);
  assert.match(stagingWorkflow, /secrets\.RAWAJ_STAGING_PROJECT_REF/);
  assert.match(stagingWorkflow, /secrets\.RAWAJ_PRODUCTION_PROJECT_REF/);
  assert.match(stagingWorkflow, /secrets\.RAWAJ_STAGING_SERVICE_ROLE_KEY/);
  assert.match(stagingWorkflow, /Checkout trusted main history/);
  assert.match(stagingWorkflow, /ref:\s*main/);
  assert.match(stagingWorkflow, /git merge-base --is-ancestor/);
  assert.match(stagingWorkflow, /Requested ref must resolve to a commit already contained in main/);
  assert.match(stagingWorkflow, /git checkout --detach "\$RAWAJ_ACCEPTANCE_TARGET_SHA"/);
  assert.match(stagingWorkflow, /Validate staging-only environment/);
  assert.match(stagingWorkflow, /RAWAJ_STAGING_PROJECT_REF" = "\$RAWAJ_PRODUCTION_PROJECT_REF/);
  assert.match(
    stagingWorkflow,
    /expected_host="https:\/\/\$\{RAWAJ_STAGING_PROJECT_REF\}\.supabase\.co"/,
  );
  assert.match(stagingWorkflow, /staging-write-acceptance\.spec\.ts/);
  assert.match(stagingWorkflow, /--project=mobile-chromium --workers=1/);
  assert.doesNotMatch(stagingWorkflow, /E2E_BASE_URL:\s*https:\/\/rawa-j\.com/);
  assert.doesNotMatch(stagingWorkflow, /PRODUCTION_ACCEPTANCE/);
  assert.doesNotMatch(stagingWorkflow, /ref:\s*\$\{\{ inputs\.ref \}\}/);
});

test("staging acceptance covers real multi-account write journeys and cleanup", () => {
  for (const marker of [
    "auth.signUp",
    "resetPasswordForEmail",
    `input[type=\"file\"]`,
    "rawaj_review_listing_decision",
    "rawaj_owner_update_listing_v3",
    "rawaj_submit_listing_for_review",
    "rawaj_set_favorite_v1",
    "saved_searches",
    "rawaj_start_listing_conversation",
    "rawaj_send_conversation_message_v2",
    "postgres_changes",
    "support_requests",
    "accountDeletionSubject",
    "cleanupAcceptanceRecords",
  ]) {
    assert.ok(stagingSpec.includes(marker), `Missing staging journey marker: ${marker}`);
  }

  assert.match(stagingSpec, /RAWAJ_STAGING_WRITE_ACCEPTANCE === "1"/);
  assert.match(stagingSpec, /https:\/\/\$\{stagingProjectRef\}\.supabase\.co/);
  assert.match(stagingSpec, /expect\(nonParticipantEventCount\)\.toBe\(0\)/);
  assert.match(stagingSpec, /expectModerationEvidence/);
  assert.match(stagingSpec, /serviceClient\.auth\.admin\.deleteUser/);
  assert.doesNotMatch(stagingSpec, /https:\/\/rawa-j\.com/);
});

test("production domain, Android package, and Cloudflare recovery entry stay canonical", () => {
  assert.match(linking, /RAWAJ_PRODUCTION_ORIGIN = "https:\/\/rawa-j\.com"/);
  assert.match(linking, /RAWAJ_PRODUCTION_HOST = "rawa-j\.com"/);
  assert.match(linking, /RAWAJ_AUTH_CALLBACK_PATH = "\/auth\/callback"/);
  assert.match(linking, /RAWAJ_ANDROID_PACKAGE_NAME = "com\.rawaj\.marketplace"/);

  assert.match(capacitorConfig, /appId: "com\.rawaj\.marketplace"/);
  assert.match(capacitorConfig, /url: "https:\/\/rawa-j\.com"/);
  assert.match(capacitorConfig, /allowNavigation: \["rawa-j\.com", "\*\.rawa-j\.com"\]/);
  assert.match(androidManifest, /android:autoVerify="true"/);
  assert.match(androidManifest, /android:scheme="https" android:host="rawa-j\.com"/);
  assert.match(androidStrings, /<string name="package_name">com\.rawaj\.marketplace<\/string>/);
  assert.match(
    androidStrings,
    /<string name="custom_url_scheme">com\.rawaj\.marketplace<\/string>/,
  );

  assert.match(authSource, /sendPasswordResetEmail/);
  assert.match(loginSource, /auth\.requestPasswordReset\(cleanEmail\)/);
  assert.doesNotMatch(authSource, /supabase\.auth/);
  assert.doesNotMatch(authSource, /requestPasswordReset[^"]*\(\s*["']https:\/\/[^"']+["']/);
  assert.match(envExample, /VITE_SITE_URL=https:\/\/rawa-j\.com/);
});

test("Digital Asset Links uses only validated release fingerprints and fails closed", () => {
  assert.match(linking, /RAWAJ_ANDROID_FINGERPRINT_ENV_NAME/);
  assert.match(linking, /RAWAJ_ANDROID_SHA256_CERT_FINGERPRINTS/);
  assert.match(linking, /COLONIZED_SHA256_PATTERN/);
  assert.match(linking, /COMPACT_SHA256_PATTERN/);
  assert.match(linking, /return \[\.\.\.new Set\(normalized\)\]/);
  assert.match(linking, /delegate_permission\/common\.handle_all_urls/);
  assert.match(linking, /namespace: "android_app"/);
  assert.match(linking, /package_name: RAWAJ_ANDROID_PACKAGE_NAME/);

  assert.match(serverSource, /androidAssetLinksPath = "\/\.well-known\/assetlinks\.json"/);
  assert.match(
    serverSource,
    /readServerEnvironmentValue\(env, RAWAJ_ANDROID_FINGERPRINT_ENV_NAME\)/,
  );
  assert.match(serverSource, /function buildAndroidAssetLinksResponse/);
  assert.match(serverSource, /fingerprints\.length === 0/);
  assert.match(serverSource, /status: 503/);
  assert.match(serverSource, /android_app_links_not_configured/);
  assert.match(serverSource, /status: 200/);
  assert.match(serverSource, /"Content-Type": "application\/json; charset=utf-8"/);
  assert.match(serverSource, /"X-Content-Type-Options": "nosniff"/);
  assert.match(
    serverSource,
    /request\.method === "GET" && url\.pathname === androidAssetLinksPath/,
  );
  assert.doesNotMatch(serverSource, /Response\.redirect|headers\.set\("location"/i);

  assert.match(envExample, /RAWAJ_ANDROID_SHA256_CERT_FINGERPRINTS=/);
  assert.doesNotMatch(envExample, /(?:[0-9A-F]{2}:){31}[0-9A-F]{2}/);
  assert.match(linkingRunbook, /Play App Signing/);
  assert.match(linkingRunbook, /must never use a debug certificate/i);
  assert.match(linkingRunbook, /intentionally returns HTTP `503`/);
});

test("quality gate permanently enforces production acceptance and linking contracts", () => {
  assert.match(packageSource, /"test:production-acceptance-contract"/);
  assert.match(packageSource, /production-acceptance-contract\.test\.mjs/);
  assert.match(qualityGate, /Production acceptance safety contract/);
  assert.match(qualityGate, /npm run test:production-acceptance-contract/);
});
