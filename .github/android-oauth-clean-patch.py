from pathlib import Path

ROOT = Path.cwd()


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"missing exact block: {label}")
    return text.replace(old, new, 1)


def patch_main_activity() -> None:
    path = "android/app/src/main/java/com/rawaj/marketplace/MainActivity.java"
    text = read(path)
    text = replace_once(
        text,
        "import android.graphics.Color;\nimport android.graphics.Typeface;",
        "import android.content.Intent;\nimport android.graphics.Color;\nimport android.graphics.Typeface;\nimport android.net.Uri;",
        "MainActivity intent imports",
    )
    text = replace_once(
        text,
        "import android.view.animation.DecelerateInterpolator;\nimport android.widget.FrameLayout;",
        "import android.view.animation.DecelerateInterpolator;\nimport android.webkit.WebView;\nimport android.widget.FrameLayout;",
        "MainActivity WebView import",
    )
    text = replace_once(
        text,
        "import com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {\n    private static final int INTRO_BACKGROUND_COLOR = Color.rgb(8, 6, 5);",
        "import com.getcapacitor.BridgeActivity;\nimport java.util.Locale;\n\npublic class MainActivity extends BridgeActivity {\n    private static final int INTRO_BACKGROUND_COLOR = Color.rgb(8, 6, 5);\n    private static final String RAWAJ_ORIGIN = \"https://rawa-j.com\";\n    private static final String RAWAJ_HOST = \"rawa-j.com\";\n    private static final String RAWAJ_AUTH_SCHEME = \"com.rawaj.marketplace\";",
        "MainActivity constants",
    )
    text = replace_once(
        text,
        "    protected void onCreate(Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n\n        if (savedInstanceState == null) {",
        "    protected void onCreate(Bundle savedInstanceState) {\n        registerPlugin(RawajNativePlugin.class);\n        super.onCreate(savedInstanceState);\n\n        routeIncomingIntent(getIntent());\n        if (savedInstanceState == null) {",
        "MainActivity onCreate",
    )
    anchor = "    private void showRawajLaunchIntro() {"
    methods = '''    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        routeIncomingIntent(intent);
    }

    @Override
    public void onBackPressed() {
        final WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    private void routeIncomingIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) {
            return;
        }

        final String targetUrl = webUrlForDeepLink(intent.getData());
        final WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (targetUrl == null || webView == null) {
            return;
        }

        webView.post(
            () -> {
                final String currentUrl = webView.getUrl();
                if (!targetUrl.equals(currentUrl)) {
                    webView.loadUrl(targetUrl);
                }
            }
        );
    }

    private String webUrlForDeepLink(Uri uri) {
        if (uri == null || uri.getScheme() == null) {
            return null;
        }

        final String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
        final String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);

        if ("https".equals(scheme)) {
            if (!RAWAJ_HOST.equals(host) && !host.endsWith("." + RAWAJ_HOST)) {
                return null;
            }
            return uri.toString();
        }

        if (
            RAWAJ_AUTH_SCHEME.equals(scheme) &&
            "auth".equals(host) &&
            "/callback".equals(uri.getPath())
        ) {
            return Uri.parse(RAWAJ_ORIGIN + "/auth/callback")
                .buildUpon()
                .encodedQuery(uri.getEncodedQuery())
                .encodedFragment(uri.getEncodedFragment())
                .build()
                .toString();
        }

        return null;
    }

'''
    text = replace_once(text, anchor, methods + anchor, "MainActivity deep-link methods")
    write(path, text)


def patch_package() -> None:
    path = "package.json"
    text = read(path)
    text = replace_once(
        text,
        '    "test:auth-recovery": "node --test scripts/auth-recovery.test.mjs",',
        '    "test:auth-recovery": "node --test scripts/auth-recovery.test.mjs",\n    "test:android-oauth-clean": "node --test scripts/android-oauth-clean.test.mjs",',
        "package Android OAuth test",
    )
    write(path, text)


def add_contract() -> None:
    write(
        "scripts/android-oauth-clean.test.mjs",
        '''import assert from "node:assert/strict";
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
    new URL("../android/app/src/main/java/com/rawaj/marketplace/MainActivity.java", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../android/app/src/main/java/com/rawaj/marketplace/RawajNativePlugin.java", import.meta.url),
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
''',
    )


patch_main_activity()
patch_package()
add_contract()
