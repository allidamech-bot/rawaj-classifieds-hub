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
  androidWorkflow,
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
    new URL("../android/app/src/main/java/com/rawaj/marketplace/MainActivity.java", import.meta.url),
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
  readFile(new URL("../.github/workflows/android-release-readiness.yml", import.meta.url), "utf8"),
]);

test("Google OAuth uses a PKCE callback owned by the Android app", () => {
  assert.match(supabase, /flowType:\s*"pkce"/);
  assert.match(supabase, /persistSession:\s*true/);
  assert.match(supabase, /autoRefreshToken:\s*true/);
  assert.match(supabase, /detectSessionInUrl:\s*!isNativeRuntime/);
  assert.match(nativeRuntime, /com\.rawaj\.marketplace:\/\/auth\/callback/);
  assert.match(auth, /skipBrowserRedirect:\s*native/);
  assert.match(auth, /if \(!data\.url\)/);
  assert.match(auth, /await openExternalUrl\(data\.url\)/);
});

test("OAuth callback exchanges the code inside the WebView and removes one-time parameters", () => {
  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.match(callback, /client\.auth\.getSession\(\)/);
  assert.match(callback, /cleanOneTimeCallbackParams/);
  assert.match(callback, /"code", "error", "error_code", "error_description"/);
  assert.match(callback, /sanitizeAuthReturnTo/);
});

test("Password recovery returns to the native callback without weakening returnTo", () => {
  assert.match(login, /createAuthCallbackUrl\(returnTo, \{ recovery: true \}\)/);
  assert.match(login, /resetPasswordForEmail/);
  assert.match(nativeRuntime, /searchParams\.set\("type", "recovery"\)/);
  assert.match(nativeRuntime, /searchParams\.set\("returnTo", returnTo\)/);
});

test("Android deep links are narrow, single-task, and mapped into RAWAJ", () => {
  assert.match(manifest, /android:launchMode="singleTask"/);
  assert.match(manifest, /android:autoVerify="true"/);
  assert.match(manifest, /android:scheme="https"/);
  assert.match(manifest, /android:host="rawa-j\.com"/);
  assert.match(manifest, /android:pathPrefix="\/"/);
  assert.match(manifest, /android:scheme="@string\/custom_url_scheme"/);
  assert.match(manifest, /android:host="auth"/);
  assert.match(manifest, /android:path="\/callback"/);

  assert.match(mainActivity, /registerPlugin\(RawajNativePlugin\.class\);\s*super\.onCreate/s);
  assert.match(mainActivity, /protected void onNewIntent\(Intent intent\)/);
  assert.match(mainActivity, /RAWAJ_AUTH_SCHEME\.equals\(scheme\)/);
  assert.match(mainActivity, /"\/callback"\.equals\(uri\.getPath\(\)\)/);
  assert.match(mainActivity, /RAWAJ_ORIGIN \+ "\/auth\/callback"/);
  assert.match(mainActivity, /if \(!targetUrl\.equals\(currentUrl\)\)/);
  assert.match(mainActivity, /webView\.loadUrl\(targetUrl\)/);
});

test("Android back navigation preserves WebView history", () => {
  assert.match(mainActivity, /public void onBackPressed\(\)/);
  assert.match(mainActivity, /webView\.canGoBack\(\)/);
  assert.match(mainActivity, /webView\.goBack\(\)/);
  assert.match(mainActivity, /super\.onBackPressed\(\)/);
});

test("External communication and map links leave the WebView through a strict native bridge", () => {
  assert.match(nativePlugin, /@CapacitorPlugin\(name = "RawajNative"\)/);
  for (const scheme of ["http", "https", "tel", "mailto", "sms", "geo", "market", "whatsapp"]) {
    assert.match(nativePlugin, new RegExp(`"${scheme}"`));
  }
  assert.match(nativePlugin, /Intent\.ACTION_VIEW/);
  assert.match(nativePlugin, /Intent\.CATEGORY_BROWSABLE/);
  assert.match(nativePlugin, /This URL scheme is not allowed/);
  assert.match(nativeAppRuntime, /target\.closest<HTMLAnchorElement>\("a\[href\]"\)/);
  assert.match(nativeAppRuntime, /!isRawajWebUrl\(url\)/);
  assert.match(nativeAppRuntime, /window\.open =/);
});

test("Slow or offline startup keeps RAWAJ branded and recoverable", () => {
  assert.match(capacitor, /backgroundColor:\s*"#080605"/);
  assert.match(capacitor, /errorPath:\s*"native-error\.html"/);
  assert.match(mainActivity, /INTRO_MIN_VISIBLE_MS = 1800L/);
  assert.match(mainActivity, /INTRO_MAX_VISIBLE_MS = 8000L/);
  assert.match(mainActivity, /webView\.getProgress\(\) < 90/);
  assert.match(mainActivity, /savedInstanceState == null/);
  assert.match(nativeErrorPage, /تعذر فتح رواج/);
  assert.match(nativeErrorPage, /window\.location\.replace\("https:\/\/rawa-j\.com"\)/);
  assert.match(nativeErrorPage, /window\.addEventListener\("online", retry\)/);
  assert.match(nativeAppRuntime, /navigator\.onLine/);
  assert.match(nativeAppRuntime, /window\.location\.reload\(\)/);
});

test("Play identity and version remain unchanged during readiness work", () => {
  assert.match(buildGradle, /applicationId "com\.rawaj\.marketplace"/);
  assert.match(buildGradle, /versionCode 4/);
  assert.match(buildGradle, /versionName "1\.0\.3"/);
});

test("Android CI validates the web bundle and native artifacts before approval", () => {
  assert.match(androidWorkflow, /Android release readiness contract/);
  assert.match(androidWorkflow, /npm run test:android-release-readiness/);
  assert.match(androidWorkflow, /actions\/setup-java@v4/);
  assert.match(androidWorkflow, /npx cap sync android/);
  assert.match(androidWorkflow, /\.\/gradlew assembleDebug bundleRelease --no-daemon/);
});
