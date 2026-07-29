import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [manifest, activity, strings, auth] = await Promise.all([
  readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../android/app/src/main/java/com/rawaj/marketplace/MainActivity.java",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../android/app/src/main/res/values/strings.xml", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/auth.tsx", import.meta.url), "utf8"),
]);

test("Android App Links remain verified and scoped to RAWAJ", () => {
  assert.match(manifest, /<intent-filter android:autoVerify="true">/);
  assert.match(manifest, /android:scheme="https" android:host="rawa-j\.com"/);
  assert.doesNotMatch(manifest, /android:host="\*"/);
});

test("native OAuth custom scheme remains package-owned", () => {
  assert.match(strings, /<string name="custom_url_scheme">com\.rawaj\.marketplace<\/string>/);
  assert.match(manifest, /android:scheme="@string\/custom_url_scheme"/);
});

test("incoming Android intents remain restricted to RAWAJ-owned targets", () => {
  assert.match(activity, /TRUSTED_WEB_HOST = "rawa-j\.com"/);
  assert.match(activity, /OAUTH_CALLBACK_PATH = "\/auth\/callback"/);
  assert.match(activity, /TRUSTED_WEB_HOST\.equalsIgnoreCase\(host\)/);
  assert.match(activity, /getString\(R\.string\.custom_url_scheme\)\.equalsIgnoreCase\(scheme\)/);
  assert.match(activity, /if \(!OAUTH_CALLBACK_PATH\.equals\(customPath\)\)/);
  assert.match(activity, /bridge\.getWebView\(\)\.loadUrl\(trustedTarget\.toString\(\)\)/);
});

test("Google OAuth uses Firebase popup and a sanitized in-app return target", () => {
  assert.match(auth, /new GoogleAuthProvider\(\)/);
  assert.match(auth, /signInWithPopup\(firebaseAuth, provider\)/);
  assert.match(auth, /sanitizeAuthReturnTo\(returnTo, "\/more"\)/);
  assert.match(auth, /window\.location\.assign\(safeReturnTo\)/);
  assert.doesNotMatch(auth, /redirectTo:\s*callbackUrl/);
});