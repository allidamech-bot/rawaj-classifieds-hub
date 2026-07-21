#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const gradlePath = path.join(repositoryRoot, "android/app/build.gradle");
const variablesPath = path.join(repositoryRoot, "android/variables.gradle");
const apkPath = resolveRequiredPath("ANDROID_RC_APK_PATH");
const aabPath = resolveRequiredPath("ANDROID_RC_AAB_PATH");
const outputDirectory = path.resolve(
  repositoryRoot,
  process.env.ANDROID_RC_OUTPUT_DIR?.trim() || "android-rc",
);

const [gradleSource, variablesSource] = await Promise.all([
  readFile(gradlePath, "utf8"),
  readFile(variablesPath, "utf8"),
]);

const expected = {
  applicationId: match(gradleSource, /applicationId\s+["']([^"']+)["']/, "application ID"),
  versionCode: Number(match(gradleSource, /versionCode\s+(\d+)/, "version code")),
  versionName: match(gradleSource, /versionName\s+["']([^"']+)["']/, "version name"),
  minSdk: Number(match(variablesSource, /minSdkVersion\s*=\s*(\d+)/, "minimum SDK")),
  targetSdk: Number(match(variablesSource, /targetSdkVersion\s*=\s*(\d+)/, "target SDK")),
  compileSdk: Number(match(variablesSource, /compileSdkVersion\s*=\s*(\d+)/, "compile SDK")),
};

const analyzed = {
  applicationId: requiredEnvironment("ANDROID_RC_ANALYZED_APPLICATION_ID"),
  versionCode: Number(requiredEnvironment("ANDROID_RC_ANALYZED_VERSION_CODE")),
  versionName: requiredEnvironment("ANDROID_RC_ANALYZED_VERSION_NAME"),
};

assert.equal(
  analyzed.applicationId,
  expected.applicationId,
  "The built APK application ID does not match android/app/build.gradle.",
);
assert.equal(
  analyzed.applicationId,
  "com.rawaj.marketplace",
  "The Android release candidate must use the canonical RAWAJ package ID.",
);
assert.equal(
  analyzed.versionCode,
  expected.versionCode,
  "The built APK version code does not match android/app/build.gradle.",
);
assert.equal(
  analyzed.versionName,
  expected.versionName,
  "The built APK version name does not match android/app/build.gradle.",
);
assert.equal(
  requiredEnvironment("ANDROID_RC_APK_SIGNING_STATE"),
  "unsigned",
  "The CI APK must remain unsigned; release signing is an external Play gate.",
);
assert.equal(
  requiredEnvironment("ANDROID_RC_AAB_SIGNING_STATE"),
  "unsigned",
  "The CI AAB must remain unsigned; release signing is an external Play gate.",
);

const checkoutCommitSha = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: repositoryRoot,
  encoding: "utf8",
}).trim();
const sourceCommitSha = (
  process.env.ANDROID_RC_SOURCE_COMMIT || checkoutCommitSha
).trim();
assert.match(
  checkoutCommitSha,
  /^[0-9a-f]{40}$/i,
  "Could not resolve the checked-out commit SHA.",
);
assert.match(
  sourceCommitSha,
  /^[0-9a-f]{40}$/i,
  "Could not resolve the source branch commit SHA.",
);

const shortSha = sourceCommitSha.slice(0, 12).toLowerCase();
const safeVersionName = expected.versionName.replace(/[^0-9A-Za-z._-]+/g, "-");
const artifactStem = `rawaj-${safeVersionName}-vc${expected.versionCode}-${shortSha}-unsigned`;
const aabName = `${artifactStem}.aab`;
const apkName = `${artifactStem}.apk`;

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  copyFile(aabPath, path.join(outputDirectory, aabName)),
  copyFile(apkPath, path.join(outputDirectory, apkName)),
]);

const [aabEvidence, apkEvidence] = await Promise.all([
  createArtifactEvidence(path.join(outputDirectory, aabName), "aab"),
  createArtifactEvidence(path.join(outputDirectory, apkName), "apk"),
]);

const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  repository: process.env.GITHUB_REPOSITORY || "allidamech-bot/rawaj-classifieds-hub",
  source: {
    commitSha: sourceCommitSha.toLowerCase(),
    checkoutCommitSha: checkoutCommitSha.toLowerCase(),
    branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "local",
  },
  android: {
    applicationId: analyzed.applicationId,
    versionCode: analyzed.versionCode,
    versionName: analyzed.versionName,
    minSdk: expected.minSdk,
    targetSdk: expected.targetSdk,
    compileSdk: expected.compileSdk,
    signing: {
      apk: "unsigned-ci-candidate",
      aab: "unsigned-ci-candidate",
      finalRelease: "external-play-signing-required",
    },
  },
  artifacts: [aabEvidence, apkEvidence],
  acceptance: {
    repositoryBuild: "passed-before-evidence-generation",
    playConsoleUpload: "external-evidence-required",
    playAppSigningFingerprint: "external-evidence-required",
    internalTestingInstall: "external-evidence-required",
    physicalDeviceSmoke: "external-evidence-required",
  },
};

const evidencePath = path.join(outputDirectory, "android-release-candidate-evidence.json");
const checksumsPath = path.join(outputDirectory, "SHA256SUMS.txt");
const readmePath = path.join(outputDirectory, "README.txt");

await Promise.all([
  writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8"),
  writeFile(
    checksumsPath,
    `${evidence.artifacts.map((artifact) => `${artifact.sha256}  ${artifact.fileName}`).join("\n")}\n`,
    "utf8",
  ),
  writeFile(
    readmePath,
    [
      "RAWAJ Android Release Candidate",
      `Application ID: ${analyzed.applicationId}`,
      `Version name: ${analyzed.versionName}`,
      `Version code: ${analyzed.versionCode}`,
      `Source commit: ${sourceCommitSha.toLowerCase()}`,
      `Workflow checkout commit: ${checkoutCommitSha.toLowerCase()}`,
      "Signing: unsigned CI candidate; Google Play App Signing and publication remain external manual gates.",
      "Do not distribute these unsigned artifacts to end users.",
      "",
    ].join("\n"),
    "utf8",
  ),
]);

const artifactName = `rawaj-android-${safeVersionName}-vc${expected.versionCode}-${shortSha}`;
if (process.env.GITHUB_OUTPUT) {
  await writeFile(
    process.env.GITHUB_OUTPUT,
    `artifact_name=${artifactName}\nevidence_path=${path.relative(repositoryRoot, evidencePath)}\n`,
    { encoding: "utf8", flag: "a" },
  );
}

process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);

function resolveRequiredPath(environmentName) {
  const value = requiredEnvironment(environmentName);
  return path.resolve(repositoryRoot, value);
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  assert.ok(value, `${name} is required.`);
  return value;
}

function match(source, pattern, label) {
  const value = source.match(pattern)?.[1];
  assert.ok(value, `Could not resolve Android ${label}.`);
  return value;
}

async function createArtifactEvidence(filePath, kind) {
  const fileStat = await stat(filePath);
  assert.ok(fileStat.isFile(), `${filePath} is not a file.`);
  assert.ok(fileStat.size > 0, `${filePath} is empty.`);
  return {
    kind,
    fileName: path.basename(filePath),
    sizeBytes: fileStat.size,
    sha256: await sha256File(filePath),
    signing: "unsigned-ci-candidate",
  };
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}
