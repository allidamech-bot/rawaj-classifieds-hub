import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  auth,
  callback,
  login,
  supabase,
  nativeRuntime,
  nativeAppRuntime,
  capacitor,
  manifest,
  mainActivity,
  nativePlugin,
  nativeErrorPage,
  buildGradle,
] = await Promise.all([
  readFile(new URL("../src/lib/auth.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/auth.callback.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/login.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/supabase.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/native-runtime.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/native/NativeAppRuntime.tsx", import.meta.url), "utf8"),
  readFile(new URL("../capacitor.config.ts", import.meta.url), "utf8"),
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
      "../android/app/src/main/java/com/rawaj/marketplace/RawajNativePlugin.java",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../public/native-error.html", import.meta.url), "utf8"),
  readFile(new URL("../android/app/build.gradle", import.meta.url), "utf8"),
]);

test("Android Google OAuth uses PKCE and an app-owned callback", () => {
  assert.match(supabase, /flowType:\s*"pkce"/);
  assert.match(supabase, /detectSessionInUrl:\s*!isNativeRuntime/);
  assert.match(supabase, /storage:\s*isNativeRuntime \? rawajAuthStorage : undefined/);
  assert.match(nativeRuntime, /com\.rawaj\.marketplace:\/\/auth\/callback/);
  assert.match(auth, /skipBrowserRedirect:\s*native/);
  assert.match(auth, /await openExternalUrl\(data\.url\)/);
});

test("Native sessions persist outside volatile WebView storage", () => {
  assert.match(nativeRuntime, /export const rawajAuthStorage/);
  assert.match(nativeRuntime, /RawajNative\.getAuthStorage/);
  assert.match(nativeRuntime, /RawajNative\.setAuthStorage/);
  assert.match(nativeRuntime, /RawajNative\.removeAuthStorage/);
  assert.match(nativePlugin, /AUTH_STORAGE_NAME = "rawaj_native_auth_storage"/);
  assert.match(nativePlugin, /getSharedPreferences\(AUTH_STORAGE_NAME, Context\.MODE_PRIVATE\)/);
  assert.match(nativePlugin, /\.commit\(\)/);
  assert.doesNotMatch(nativePlugin, /Log\.|System\.out|println/);
});

test("OAuth and recovery callbacks exchange fresh codes and remove one-time values", () => {
  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.match(callback, /cleanOneTimeCallbackParams/);
  assert.match(callback, /"code", "error", "error_code", "error_description"/);
  assert.match(login, /createAuthCallbackUrl\(returnTo, \{ recovery: true \}\)/);
  assert.match(nativeRuntime, /searchParams\.set\("type", "recovery"\)/);
  assert.match(nativeRuntime, /searchParams\.set\("returnTo", returnTo\)/);
});

test("Android links are narrow and mapped into the current RAWAJ origin", () => {
  assert.match(manifest, /android:launchMode="singleTask"/);
  assert.match(manifest, /android:autoVerify="true"/);
  assert.match(manifest, /android:host="rawa-j\.com"/);
  assert.match(manifest, /android:scheme="@string\/custom_url_scheme"/);
  assert.match(manifest, /android:host="auth"/);
  assert.match(manifest, /android:path="\/callback"/);
  assert.match(mainActivity, /registerPlugin\(RawajNativePlugin\.class\);\s*super\.onCreate/s);
  assert.match(mainActivity, /protected void onNewIntent\(Intent intent\)/);
  assert.match(mainActivity, /RAWAJ_ORIGIN \+ "\/auth\/callback"/);
  assert.match(mainActivity, /webView\.loadUrl\(targetUrl\)/);
});

test("Android Back and external links use the native bridge safely", () => {
  assert.match(mainActivity, /public void onBackPressed\(\)/);
  assert.match(mainActivity, /webView\.canGoBack\(\)/);
  assert.match(mainActivity, /webView\.goBack\(\)/);
  assert.match(nativePlugin, /@CapacitorPlugin\(name = "RawajNative"\)/);
  assert.match(nativePlugin, /This URL scheme is not allowed/);
  assert.match(nativeAppRuntime, /target\.closest<HTMLAnchorElement>\("a\[href\]"\)/);
  assert.match(nativeAppRuntime, /window\.open =/);
});

test("Offline startup remains recoverable without changing Play identity", () => {
  assert.match(capacitor, /backgroundColor:\s*"#080605"/);
  assert.match(capacitor, /errorPath:\s*"native-error\.html"/);
  assert.match(nativeErrorPage, /تعذر فتح رواج/);
  assert.match(nativeErrorPage, /window\.addEventListener\("online", retry\)/);
  assert.match(buildGradle, /applicationId "com\.rawaj\.marketplace"/);
  assert.match(buildGradle, /versionCode 4/);
  assert.match(buildGradle, /versionName "1\.0\.3"/);
});
