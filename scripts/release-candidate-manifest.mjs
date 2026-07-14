import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const [androidGradle, capacitorConfig, packageSource] = await Promise.all([
  readFile(new URL("../android/app/build.gradle", import.meta.url), "utf8"),
  readFile(new URL("../capacitor.config.ts", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

const gitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const expectedCommitSha = process.env.EXPECTED_COMMIT_SHA || gitSha;
assert.equal(
  gitSha,
  expectedCommitSha,
  "The checked-out commit does not match EXPECTED_COMMIT_SHA.",
);

const match = (source, pattern, label) => {
  const value = source.match(pattern)?.[1];
  assert.ok(value, `Could not resolve ${label}.`);
  return value;
};

const packageJson = JSON.parse(packageSource);
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  repository: process.env.GITHUB_REPOSITORY ?? "allidamech-bot/rawaj-classifieds-hub",
  commitSha: gitSha,
  branch: process.env.GITHUB_REF_NAME ?? "local",
  web: {
    productionUrl: match(capacitorConfig, /url:\s*"([^"]+)"/, "production URL"),
    outputDirectory: match(capacitorConfig, /webDir:\s*"([^"]+)"/, "web output directory"),
    performanceBudgetVerified: true,
  },
  android: {
    applicationId: match(androidGradle, /applicationId\s+"([^"]+)"/, "Android application ID"),
    versionCode: Number(match(androidGradle, /versionCode\s+(\d+)/, "Android version code")),
    versionName: match(androidGradle, /versionName\s+"([^"]+)"/, "Android version name"),
    artifact: "android/app/build/outputs/apk/debug/app-debug.apk",
    signing: "debug-artifact-only-release-signing-required-externally",
  },
  runtime: {
    node: process.version,
    react: packageJson.dependencies.react,
    tanstackStart: packageJson.dependencies["@tanstack/react-start"],
    capacitor: packageJson.dependencies["@capacitor/core"],
  },
  acceptance: {
    repositoryQualityGate: "required",
    crossBrowserReleaseSuite: "required",
    productionAcceptance:
      process.env.PRODUCTION_ACCEPTANCE === "1" ? "executed" : "external-run-required",
    physicalAndroidDevice: "external-evidence-required",
    playConsoleAndReleaseSigning: "external-evidence-required",
  },
};

await writeFile("release-candidate-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
