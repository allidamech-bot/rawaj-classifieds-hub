import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [capacitor, manifest, strings, qualityGate] = await Promise.all([
  readFile(new URL("../capacitor.config.ts", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/res/values/strings.xml", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("Capacitor uses the production RAWAJ origin without cleartext traffic", () => {
  assert.match(capacitor, /appId:\s*"com\.rawaj\.marketplace"/);
  assert.match(capacitor, /url:\s*"https:\/\/rawa-j\.com"/);
  assert.match(capacitor, /cleartext:\s*false/);
  assert.match(capacitor, /allowNavigation:\s*\["rawa-j\.com", "\*\.rawa-j\.com"\]/);
});

test("Android launch configuration protects app data and supports RAWAJ links", () => {
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android:name="android\.intent\.action\.VIEW"/);
  assert.match(manifest, /android:name="android\.intent\.category\.BROWSABLE"/);
  assert.match(manifest, /android:scheme="https"/);
  assert.match(manifest, /android:host="rawa-j\.com"/);
  assert.match(manifest, /android:scheme="@string\/custom_url_scheme"/);
});

test("Android identity remains aligned with the Play package", () => {
  assert.match(strings, /<string name="package_name">com\.rawaj\.marketplace<\/string>/);
  assert.match(strings, /<string name="custom_url_scheme">com\.rawaj\.marketplace<\/string>/);
});

test("Batch 7 is permanently part of the Quality Gate", () => {
  assert.match(qualityGate, /Launch readiness Batch 7 contract/);
  assert.match(qualityGate, /node --test scripts\/launch-readiness-batch-7\.test\.mjs/);
});
