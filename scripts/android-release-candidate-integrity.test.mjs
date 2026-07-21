import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

const [workflow, evidenceScript, androidGradle, contractWorkflow] = await Promise.all([
  readFile(new URL("../.github/workflows/android-release-candidate.yml", import.meta.url), "utf8"),
  readFile(new URL("./build-android-release-candidate-evidence.mjs", import.meta.url), "utf8"),
  readFile(new URL("../android/app/build.gradle", import.meta.url), "utf8"),
  readFile(
    new URL("../.github/workflows/android-release-candidate-integrity.yml", import.meta.url),
    "utf8",
  ),
]);

test("Android release candidate workflow is build-only and read-only", () => {
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /bundleRelease assembleRelease/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.doesNotMatch(
    workflow,
    /play.*upload|publishBundle|promote.*track|serviceAccountCredentials|signingConfig/i,
  );
  assert.doesNotMatch(androidGradle, /signingConfig\s+/);
});

test("artifact identity is derived from the built APK instead of duplicated constants", () => {
  assert.match(workflow, /apkanalyzer/);
  assert.match(workflow, /manifest application-id/);
  assert.match(workflow, /manifest version-code/);
  assert.match(workflow, /manifest version-name/);
  assert.match(workflow, /ANDROID_RC_ANALYZED_APPLICATION_ID/);
  assert.match(workflow, /ANDROID_RC_ANALYZED_VERSION_CODE/);
  assert.match(workflow, /ANDROID_RC_ANALYZED_VERSION_NAME/);
  assert.match(workflow, /build-android-release-candidate-evidence\.mjs/);

  assert.doesNotMatch(workflow, /rawaj-1\.0\.4-rc1/);
  assert.doesNotMatch(workflow, /Version name:\s*1\.0\.4/);
  assert.doesNotMatch(workflow, /Version code:\s*5/);
  assert.match(workflow, /steps\.evidence\.outputs\.artifact_name/);
});

test("CI artifacts are proven unsigned before evidence is emitted", () => {
  assert.match(workflow, /apksigner/);
  assert.match(workflow, /jarsigner -verify/);
  assert.match(workflow, /APK unexpectedly contains a signing certificate/);
  assert.match(workflow, /AAB is not the expected unsigned CI candidate/);
  assert.match(workflow, /ANDROID_RC_APK_SIGNING_STATE:\s*unsigned/);
  assert.match(workflow, /ANDROID_RC_AAB_SIGNING_STATE:\s*unsigned/);

  assert.match(evidenceScript, /external-play-signing-required/);
  assert.match(evidenceScript, /Do not distribute these unsigned artifacts/);
  assert.match(evidenceScript, /Google Play App Signing and publication remain external manual gates/);
});

test("evidence is bound to the source branch head rather than the temporary PR merge commit", () => {
  assert.match(
    workflow,
    /ANDROID_RC_SOURCE_COMMIT:\s*\$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/,
  );
  assert.match(evidenceScript, /ANDROID_RC_SOURCE_COMMIT/);
  assert.match(evidenceScript, /sourceCommitSha/);
  assert.match(evidenceScript, /checkoutCommitSha/);
  assert.match(evidenceScript, /commitSha:\s*sourceCommitSha\.toLowerCase\(\)/);
  assert.match(evidenceScript, /checkoutCommitSha:\s*checkoutCommitSha\.toLowerCase\(\)/);
  assert.match(evidenceScript, /const shortSha = sourceCommitSha\.slice/);
});

test("evidence generator ties artifact identity to Gradle and the canonical package", () => {
  assert.match(evidenceScript, /android\/app\/build\.gradle/);
  assert.match(evidenceScript, /android\/variables\.gradle/);
  assert.match(evidenceScript, /The built APK application ID does not match/);
  assert.match(evidenceScript, /com\.rawaj\.marketplace/);
  assert.match(evidenceScript, /The built APK version code does not match/);
  assert.match(evidenceScript, /The built APK version name does not match/);
  assert.match(evidenceScript, /sha256/);
  assert.match(evidenceScript, /sizeBytes/);
  assert.match(evidenceScript, /source:\s*\{/);
  assert.match(evidenceScript, /commitSha/);
});

test("lightweight integrity contract permanently covers Android RC changes", () => {
  assert.match(contractWorkflow, /pull_request:/);
  assert.match(contractWorkflow, /push:/);
  assert.match(contractWorkflow, /branches:\s*\n\s*- main/);
  assert.match(contractWorkflow, /permissions:\s*\n\s*contents: read/);
  assert.match(contractWorkflow, /android-release-candidate-integrity\.test\.mjs/);
});
