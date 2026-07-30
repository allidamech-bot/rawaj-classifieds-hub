import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [manifest, mainActivity, rawajActivity, strings, plugin, gradle, auth, nativeGoogleAuth] =
  await Promise.all([
    readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../android/app/src/main/java/com/rawaj/marketplace/MainActivity.java",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../android/app/src/main/java/com/rawaj/marketplace/RawajActivity.java",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../android/app/src/main/res/values/strings.xml", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../android/app/src/main/java/com/rawaj/marketplace/RawajGoogleAuthPlugin.java",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../android/app/build.gradle", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/auth.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/native-google-auth.ts", import.meta.url), "utf8"),
  ]);

test("Android App Links remain verified and scoped to RAWAJ", () => {
  assert.match(manifest, /<intent-filter android:autoVerify="true">/);
  assert.match(manifest, /android:scheme="https" android:host="rawa-j\.com"/);
  assert.match(manifest, /android:name="\.RawajActivity"/);
  assert.doesNotMatch(manifest, /android:host="\*"/);
});

test("native OAuth custom scheme remains package-owned", () => {
  assert.match(strings, /<string name="custom_url_scheme">com\.rawaj\.marketplace<\/string>/);
  assert.match(manifest, /android:scheme="@string\/custom_url_scheme"/);
});

test("incoming Android intents remain restricted to RAWAJ-owned targets", () => {
  assert.match(mainActivity, /TRUSTED_WEB_HOST = "rawa-j\.com"/);
  assert.match(mainActivity, /OAUTH_CALLBACK_PATH = "\/auth\/callback"/);
  assert.match(mainActivity, /TRUSTED_WEB_HOST\.equalsIgnoreCase\(host\)/);
  assert.match(mainActivity, /getString\(R\.string\.custom_url_scheme\)\.equalsIgnoreCase\(scheme\)/);
  assert.match(mainActivity, /if \(!OAUTH_CALLBACK_PATH\.equals\(customPath\)\)/);
  assert.match(mainActivity, /bridge\.getWebView\(\)\.loadUrl\(trustedTarget\.toString\(\)\)/);
});

test("Capacitor registers the native Google bridge before startup", () => {
  assert.match(rawajActivity, /extends MainActivity/);
  assert.match(
    rawajActivity,
    /registerPlugin\(RawajGoogleAuthPlugin\.class\);[\s\S]*super\.onCreate\(savedInstanceState\);/,
  );
  assert.match(plugin, /@CapacitorPlugin\(name = "RawajGoogleAuth"\)/);
  assert.match(plugin, /@PluginMethod[\s\S]*public void signIn\(PluginCall call\)/);
  assert.match(plugin, /@PluginMethod[\s\S]*public void clearCredentialState\(PluginCall call\)/);
});

test("Android Google sign-in uses Credential Manager explicit-button flow", () => {
  assert.match(gradle, /androidx\.credentials:credentials:1\.3\.0/);
  assert.match(gradle, /androidx\.credentials:credentials-play-services-auth:1\.3\.0/);
  assert.match(gradle, /com\.google\.android\.libraries\.identity\.googleid:googleid:1\.2\.0/);
  assert.match(plugin, /new GetSignInWithGoogleOption\.Builder\(serverClientId\)\.build\(\)/);
  assert.match(plugin, /CredentialManager\.create\(getContext\(\)\)/);
  assert.match(plugin, /credentialManager\.getCredentialAsync\(/);
  assert.match(plugin, /GoogleIdTokenCredential\.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL/);
  assert.match(plugin, /GoogleIdTokenCredential\.createFrom\(data\)/);
  assert.match(plugin, /result\.put\("idToken", idToken\)/);
  assert.match(
    plugin,
    /getIdentifier\("default_web_client_id", "string", getContext\(\)\.getPackageName\(\)\)/,
  );
  assert.doesNotMatch(plugin, /Log\.[diewv]\([^\n]*idToken/);
});

test("web Firebase exchanges the native ID token and keeps popup as web fallback", () => {
  assert.match(nativeGoogleAuth, /registerPlugin<NativeGoogleAuthPlugin>\("RawajGoogleAuth"\)/);
  assert.match(
    nativeGoogleAuth,
    /Capacitor\.isNativePlatform\(\) && Capacitor\.getPlatform\(\) === "android"/,
  );
  assert.match(auth, /requestNativeGoogleIdToken\(\)/);
  assert.match(auth, /GoogleAuthProvider\.credential\(idToken\)/);
  assert.match(auth, /signInWithCredential\(firebaseAuth, credential\)/);
  assert.match(auth, /signInWithPopup\(firebaseAuth, provider\)/);
  assert.match(auth, /googleSignInRequestRef\.current/);
  assert.match(auth, /clearNativeGoogleCredentialState\(\)/);
  assert.match(auth, /sanitizeAuthReturnTo\(returnTo, "\/more"\)/);
  assert.match(auth, /window\.location\.assign\(safeReturnTo\)/);
  assert.doesNotMatch(auth, /redirectTo:\s*callbackUrl/);
  assert.doesNotMatch(nativeGoogleAuth, /localStorage|sessionStorage|indexedDB/);
});
