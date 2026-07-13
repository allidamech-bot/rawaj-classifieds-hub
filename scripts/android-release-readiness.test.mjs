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
  preparePreview,
  verifyPreview,
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
  readFile(new URL("../.github/workflows/android-release-readiness.yml", import.meta.url), "utf8"),
  readFile(new URL("./prepare_android_bundled_preview.py", import.meta.url), "utf8"),
  readFile(new URL("./verify_android_bundled_preview.py", import.meta.url), "utf8"),
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

test("Native auth sessions survive WebView reloads and app restarts", () => {
  assert.match(supabase, /storage:\s*isNativeRuntime \? rawajAuthStorage : undefined/);
  assert.match(nativeRuntime, /export const rawajAuthStorage/);
  assert.match(nativeRuntime, /RawajNative\.getAuthStorage/);
  assert.match(nativeRuntime, /RawajNative\.setAuthStorage/);
  assert.match(nativeRuntime, /RawajNative\.removeAuthStorage/);
  assert.match(nativeRuntime, /legacyValue/);
  assert.match(nativePlugin, /AUTH_STORAGE_NAME = "rawaj_native_auth_storage"/);
  assert.match(nativePlugin, /getSharedPreferences\(AUTH_STORAGE_NAME, Context\.MODE_PRIVATE\)/);
  assert.match(nativePlugin, /public void getAuthStorage/);
  assert.match(nativePlugin, /public void setAuthStorage/);
  assert.match(nativePlugin, /public void removeAuthStorage/);
  assert.match(nativePlugin, /\.commit\(\)/);
  assert.doesNotMatch(nativePlugin, /Log\.|System\.out|println/);
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
  assert.match(nativeAppRuntime, /localizeBundledPreviewUrl/);
  assert.match(nativeAppRuntime, /window\.location\.origin !== "https:\/\/localhost"/);
  assert.match(nativeAppRuntime, /!isRawajWebUrl\(url\)/);
  assert.match(nativeAppRuntime, /window\.open =/);
  assert.match(nativeRuntime, /url\.origin === window\.location\.origin/);
});

test("Slow or offline startup keeps RAWAJ branded and recoverable", () => {
  assert.match(capacitor, /backgroundColor:\s*"#080605"/);
  assert.match(capacitor, /errorPath:\s*"native-error\.html"/);
  assert.match(mainActivity, /INTRO_MIN_VISIBLE_MS = 650L/);
  assert.match(mainActivity, /INTRO_MAX_VISIBLE_MS = 2400L/);
  assert.match(mainActivity, /webView\.getProgress\(\) < 70/);
  assert.match(mainActivity, /savedInstanceState == null/);
  assert.match(nativeErrorPage, /تعذر فتح رواج/);
  assert.match(nativeErrorPage, /window\.location\.origin === "https:\/\/localhost"/);
  assert.match(nativeErrorPage, /window\.location\.replace\(retryTarget\)/);
  assert.match(nativeErrorPage, /window\.addEventListener\("online", retry\)/);
  assert.match(nativeAppRuntime, /navigator\.onLine/);
  assert.match(nativeAppRuntime, /window\.location\.reload\(\)/);
});

test("Android device tests bundle the branch UI without changing production release routing", () => {
  assert.match(capacitor, /PRODUCTION_SERVER_URL = "https:\/\/rawa-j\.com"/);
  assert.match(capacitor, /RAWAJ_ANDROID_BUNDLED_PREVIEW === "1"/);
  assert.match(capacitor, /androidScheme:\s*"https"/);
  assert.match(capacitor, /url:\s*serverUrl/);
  assert.match(androidWorkflow, /Create self-contained branch preview shell/);
  assert.match(androidWorkflow, /wrangler@latest dev/);
  assert.match(androidWorkflow, /--config \.output\/server\/wrangler\.json/);
  assert.match(androidWorkflow, /cp \/tmp\/rawaj-index\.html \.output\/public\/index\.html/);
  assert.match(androidWorkflow, /RAWAJ_ANDROID_BUNDLED_PREVIEW:\s*"1"/);
  assert.match(androidWorkflow, /Lock bundled preview to local origin/);
  assert.match(androidWorkflow, /python scripts\/prepare_android_bundled_preview\.py/);
  assert.match(androidWorkflow, /python scripts\/verify_android_bundled_preview\.py/);
  assert.match(androidWorkflow, /Assemble bundled branch-preview debug APK/);
  assert.match(androidWorkflow, /Restore production Android configuration/);
  assert.match(androidWorkflow, /rawaj-android-1\.0\.3-bundled-preview-apk/);

  assert.match(preparePreview, /RAWAJ_ORIGIN = "https:\/\/localhost"/);
  assert.match(preparePreview, /forceBundledPreviewOrigin/);
  assert.match(preparePreview, /localPreviewUrl/);
  assert.doesNotMatch(preparePreview, /clearCache\(true\)/);

  assert.match(verifyPreview, /Bundled preview unexpectedly contains server\.url/);
  assert.match(verifyPreview, /rawaj-chat-inbox/);
  assert.match(verifyPreview, /rawaj-message-workspace/);
  assert.match(verifyPreview, /getAuthStorage/);
});

test("Play identity and version remain unchanged during readiness work", () => {
  assert.match(buildGradle, /applicationId "com\.rawaj\.marketplace"/);
  assert.match(buildGradle, /versionCode 4/);
  assert.match(buildGradle, /versionName "1\.0\.3"/);
});

test("Android CI validates the web bundle and native artifacts before approval", () => {
  assert.match(androidWorkflow, /Android release readiness contract/);
  assert.match(androidWorkflow, /npm run test:android-release-readiness/);
  assert.match(androidWorkflow, /Mobile app stabilization contract/);
  assert.match(androidWorkflow, /npm run test:mobile-app-stabilization/);
  assert.match(androidWorkflow, /actions\/setup-java@v4/);
  assert.match(androidWorkflow, /npx cap sync android/);
  assert.match(androidWorkflow, /\.\/gradlew assembleDebug --no-daemon/);
  assert.match(androidWorkflow, /Verify debug APK signature/);
  assert.match(androidWorkflow, /apksigner.*verify --verbose --print-certs/s);
  assert.match(androidWorkflow, /Verified using v\[23\] scheme/);
  assert.match(androidWorkflow, /\.\/gradlew bundleRelease --no-daemon/);
  assert.match(androidWorkflow, /app-release\.aab/);
  assert.match(androidWorkflow, /Verify release AAB exists without publishing/);
  assert.doesNotMatch(androidWorkflow, /google.?play|play.?store|publishBundle|upload.*aab/i);
});
