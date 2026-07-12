import { replaceOnce } from "./mobile-stabilization-patch-utils.mjs";

await replaceOnce(
  "package.json",
  "npm run test:android-release-readiness && npm run test:listing-studio-images",
  "npm run test:android-release-readiness && npm run test:mobile-app-stabilization && npm run test:listing-studio-images",
  "quality check mobile stabilization",
);
await replaceOnce(
  "package.json",
  '    "test:android-release-readiness": "node --test scripts/android-release-readiness.test.mjs",',
  '    "test:android-release-readiness": "node --test scripts/android-release-readiness.test.mjs",\n    "test:mobile-app-stabilization": "node --test scripts/mobile-app-stabilization.test.mjs",',
  "mobile stabilization npm script",
);

await replaceOnce(
  "scripts/android-release-readiness.test.mjs",
  "INTRO_MIN_VISIBLE_MS = 1800L",
  "INTRO_MIN_VISIBLE_MS = 650L",
  "readiness intro minimum",
);
await replaceOnce(
  "scripts/android-release-readiness.test.mjs",
  "INTRO_MAX_VISIBLE_MS = 8000L",
  "INTRO_MAX_VISIBLE_MS = 2400L",
  "readiness intro maximum",
);
await replaceOnce(
  "scripts/android-release-readiness.test.mjs",
  "webView\\.getProgress\\(\\) < 90",
  "webView\\.getProgress\\(\\) < 70",
  "readiness progress threshold",
);

const batch7 = "scripts/launch-readiness-batch-7.test.mjs";
await replaceOnce(
  batch7,
  `  launchStyles,
  splashDrawable,
  launcherLegacy,`,
  `  launchStyles,
  launcherLegacy,`,
  "batch 7 remove old splash fixture",
);
await replaceOnce(
  batch7,
  `  readFile(new URL("../android/app/src/main/res/values/styles.xml", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/res/drawable/splash.xml", import.meta.url), "utf8"),
  readFile(`,
  `  readFile(new URL("../android/app/src/main/res/values/styles.xml", import.meta.url), "utf8"),
  readFile(`,
  "batch 7 remove old splash read",
);
await replaceOnce(
  batch7,
  `test("RAWAJ owns the native icon and system splash", async () => {
  assert.match(manifest, /android:icon="@mipmap\\/rawaj_launcher"/);
  assert.match(manifest, /android:roundIcon="@mipmap\\/rawaj_launcher_round"/);
  assert.match(launcherLegacy, /@color\\/rawaj_launcher_background/);
  assert.match(launcherLegacy, /@drawable\\/rawaj_logo_foreground/);
  assert.match(launcherAdaptive, /<adaptive-icon/);
  assert.match(launcherAdaptive, /@drawable\\/rawaj_logo_foreground/);
  assert.match(launchStyles, /windowSplashScreenBackground/);
  assert.match(launchStyles, /windowSplashScreenAnimatedIcon/);
  assert.match(launchStyles, /@drawable\\/rawaj_logo_foreground/);
  assert.match(launchStyles, /postSplashScreenTheme/);
  assert.match(splashDrawable, /@drawable\\/rawaj_logo_mark/);
  assert.match(splashDrawable, /232dp/);

  const logoAsset = await stat(
    new URL("../android/app/src/main/res/drawable-nodpi/rawaj_logo_mark.png", import.meta.url),
  );
  assert.ok(logoAsset.size > 10_000);
});`,
  `test("RAWAJ owns a safe-zone launcher icon and one seamless system hand-off", async () => {
  assert.match(manifest, /android:icon="@mipmap\\/rawaj_launcher"/);
  assert.match(manifest, /android:roundIcon="@mipmap\\/rawaj_launcher_round"/);
  assert.match(launcherLegacy, /@color\\/rawaj_launcher_background/);
  assert.match(launcherLegacy, /android:width="38dp"/);
  assert.match(launcherAdaptive, /<adaptive-icon/);
  assert.match(launcherAdaptive, /@drawable\\/rawaj_launcher_foreground/);
  assert.match(launchStyles, /windowSplashScreenBackground/);
  assert.match(launchStyles, /@drawable\\/rawaj_splash_transparent/);
  assert.doesNotMatch(launchStyles, /@drawable\\/splash/);
  assert.match(launchStyles, /postSplashScreenTheme/);

  const logoAsset = await stat(
    new URL("../android/app/src/main/res/drawable-nodpi/rawaj_logo_mark.png", import.meta.url),
  );
  assert.ok(logoAsset.size > 10_000);
});`,
  "batch 7 single splash contract",
);
await replaceOnce(
  batch7,
  `  assert.match(mainActivity, /setStartDelay\\(420L\\)/);
  assert.match(mainActivity, /INTRO_MIN_VISIBLE_MS = 1800L/);
  assert.match(mainActivity, /INTRO_MAX_VISIBLE_MS = 8000L/);
  assert.match(mainActivity, /isWebContentReady\\(webView\\)/);
  assert.match(mainActivity, /setDuration\\(380L\\)/);`,
  `  assert.match(mainActivity, /setStartDelay\\(180L\\)/);
  assert.match(mainActivity, /INTRO_MIN_VISIBLE_MS = 650L/);
  assert.match(mainActivity, /INTRO_MAX_VISIBLE_MS = 2400L/);
  assert.match(mainActivity, /isWebContentReady\\(webView\\)/);
  assert.match(mainActivity, /setDuration\\(220L\\)/);`,
  "batch 7 fast intro contract",
);
