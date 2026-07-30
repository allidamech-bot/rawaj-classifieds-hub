import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [manifest, rawajActivity] = await Promise.all([
  readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../android/app/src/main/java/com/rawaj/marketplace/RawajActivity.java",
      import.meta.url,
    ),
    "utf8",
  ),
]);

for (const permission of [
  "android.permission.RECORD_AUDIO",
  "android.permission.CAMERA",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
]) {
  test(`Android manifest declares ${permission}`, () => {
    assert.match(manifest, new RegExp(`<uses-permission android:name="${permission}"`));
  });
}

test("Android location remains foreground-only", () => {
  assert.doesNotMatch(manifest, /android\.permission\.ACCESS_BACKGROUND_LOCATION/);
});

test("Android app keeps cleartext disabled and uses the RAWAJ package-owned activity", () => {
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android:name="\.RawajActivity"/);
  assert.match(manifest, /android:launchMode="singleTask"/);
  assert.match(rawajActivity, /extends MainActivity/);
  assert.match(rawajActivity, /registerPlugin\(RawajGoogleAuthPlugin\.class\)/);
});
