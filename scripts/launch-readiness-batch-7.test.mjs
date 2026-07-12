import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const [
  capacitor,
  manifest,
  strings,
  buildGradle,
  rootGitignore,
  androidGitignore,
  qualityGate,
  mainActivity,
  launchStyles,
  splashDrawable,
  launcherLegacy,
  launcherAdaptive,
] = await Promise.all([
  readFile(new URL("../capacitor.config.ts", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/res/values/strings.xml", import.meta.url), "utf8"),
  readFile(new URL("../android/app/build.gradle", import.meta.url), "utf8"),
  readFile(new URL("../.gitignore", import.meta.url), "utf8"),
  readFile(new URL("../android/.gitignore", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../android/app/src/main/java/com/rawaj/marketplace/MainActivity.java",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../android/app/src/main/res/values/styles.xml", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/res/drawable/splash.xml", import.meta.url), "utf8"),
  readFile(
    new URL("../android/app/src/main/res/mipmap-anydpi/rawaj_launcher.xml", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../android/app/src/main/res/mipmap-anydpi-v26/rawaj_launcher.xml", import.meta.url),
    "utf8",
  ),
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
  assert.match(buildGradle, /applicationId "com\.rawaj\.marketplace"/);
});

test("Android release is prepared for Play version 1.0.3", () => {
  assert.match(buildGradle, /versionCode 4/);
  assert.match(buildGradle, /versionName "1\.0\.3"/);
  assert.doesNotMatch(buildGradle, /versionCode 3/);
  assert.doesNotMatch(buildGradle, /versionName "1\.0\.2"/);
});

test("RAWAJ owns the native icon and system splash", async () => {
  assert.match(manifest, /android:icon="@mipmap\/rawaj_launcher"/);
  assert.match(manifest, /android:roundIcon="@mipmap\/rawaj_launcher_round"/);
  assert.match(launcherLegacy, /@color\/rawaj_launcher_background/);
  assert.match(launcherLegacy, /@drawable\/rawaj_logo_foreground/);
  assert.match(launcherAdaptive, /<adaptive-icon/);
  assert.match(launcherAdaptive, /@drawable\/rawaj_logo_foreground/);
  assert.match(launchStyles, /windowSplashScreenBackground/);
  assert.match(launchStyles, /windowSplashScreenAnimatedIcon/);
  assert.match(launchStyles, /@drawable\/rawaj_logo_foreground/);
  assert.match(launchStyles, /postSplashScreenTheme/);
  assert.match(splashDrawable, /@drawable\/rawaj_logo_mark/);
  assert.match(splashDrawable, /232dp/);

  const logoAsset = await stat(
    new URL("../android/app/src/main/res/drawable-nodpi/rawaj_logo_mark.png", import.meta.url),
  );
  assert.ok(logoAsset.size > 10_000);
});

test("RAWAJ launch intro is native, animated, readiness-aware, and fresh-activity only", () => {
  assert.match(mainActivity, /savedInstanceState == null/);
  assert.match(mainActivity, /R\.drawable\.rawaj_intro_background/);
  assert.match(mainActivity, /R\.drawable\.rawaj_logo_mark/);
  assert.match(mainActivity, /arabicName\.setText\("رواج"\)/);
  assert.match(mainActivity, /englishName\.setText\("R A W A J"\)/);
  assert.match(mainActivity, /setScaleX\(0\.76f\)/);
  assert.match(mainActivity, /setStartDelay\(420L\)/);
  assert.match(mainActivity, /INTRO_MIN_VISIBLE_MS = 1800L/);
  assert.match(mainActivity, /INTRO_MAX_VISIBLE_MS = 8000L/);
  assert.match(mainActivity, /isWebContentReady\(webView\)/);
  assert.match(mainActivity, /setDuration\(380L\)/);
  assert.match(mainActivity, /root\.removeView\(overlay\)/);
});

test("Android signing credentials cannot be committed accidentally", () => {
  for (const ignoreSource of [rootGitignore, androidGitignore]) {
    assert.match(ignoreSource, /^\*\.jks$/m);
    assert.match(ignoreSource, /^\*\.keystore$/m);
    assert.match(ignoreSource, /^\*\.p12$/m);
    assert.match(ignoreSource, /^keystore\.properties$/m);
    assert.match(ignoreSource, /^signing\.properties$/m);
    assert.match(ignoreSource, /^key\.properties$/m);
  }
});

test("Batch 7 is permanently part of the Quality Gate", () => {
  assert.match(qualityGate, /Launch readiness Batch 7 contract/);
  assert.match(qualityGate, /node --test scripts\/launch-readiness-batch-7\.test\.mjs/);
});
