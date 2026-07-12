from pathlib import Path
import json


def replace(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


replace(
    "src/lib/supabase.ts",
    '        detectSessionInUrl: true,\n',
    '        detectSessionInUrl: true,\n        flowType: "pkce",\n',
)

replace(
    "android/app/src/main/AndroidManifest.xml",
    '                <data android:scheme="@string/custom_url_scheme" />',
    '                <data\n                    android:scheme="@string/custom_url_scheme"\n                    android:host="auth"\n                    android:path="/callback" />',
)

auth_path = Path("src/lib/auth.tsx")
auth = auth_path.read_text()
auth = auth.replace(
    'import { sanitizeAuthReturnTo } from "./auth-return";\n',
    'import { sanitizeAuthReturnTo } from "./auth-return";\nimport {\n  buildAuthCallbackUrl,\n  closeNativeAuthBrowser,\n  completeNativeAuthCallback,\n  isNativeApp,\n  nativeAuthCallbackFingerprint,\n  openNativeAuthBrowser,\n  subscribeToNativeAuthCallbacks,\n} from "./native-auth";\n',
    1,
)

anchor = '  }, []);\n\n  const value = useMemo<AuthContextValue>(() => {'
native_effect = '''  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client || !isNativeApp()) return;

    let active = true;
    let removeListener: (() => Promise<void>) | undefined;
    const processing = new Set<string>();

    async function handleNativeCallback(rawUrl: string) {
      const fingerprint = nativeAuthCallbackFingerprint(rawUrl);
      if (!fingerprint || processing.has(fingerprint)) return;
      if (window.sessionStorage.getItem("rawaj:native-auth:last-callback") === fingerprint) return;
      processing.add(fingerprint);

      try {
        const completion = await completeNativeAuthCallback(client, rawUrl);
        if (!completion) {
          processing.delete(fingerprint);
          return;
        }

        window.sessionStorage.setItem("rawaj:native-auth:last-callback", fingerprint);
        await closeNativeAuthBrowser();

        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (!data.session) throw new Error("The native authentication session was not created.");
        if (!active) return;

        setSession(data.session);
        setStatus("signedIn");
        setReason(null);

        const destination =
          completion.kind === "recovery"
            ? `/reset-password?returnTo=${encodeURIComponent(completion.returnTo)}`
            : completion.returnTo;
        window.location.assign(destination);
      } catch (error) {
        if (!active) return;
        window.sessionStorage.setItem("rawaj:native-auth:last-callback", fingerprint);
        await closeNativeAuthBrowser();
        const message = error instanceof Error ? error.message : "Native authentication failed.";
        setStatus("authError");
        setReason(message);
        window.location.assign(
          `/login?returnTo=${encodeURIComponent("/more")}&authError=native_callback_failed`,
        );
      } finally {
        processing.delete(fingerprint);
      }
    }

    void subscribeToNativeAuthCallbacks(handleNativeCallback).then((remove) => {
      if (!active) {
        void remove();
        return;
      }
      removeListener = remove;
    });

    return () => {
      active = false;
      void removeListener?.();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {'''
if anchor not in auth:
    raise SystemExit("Auth effect insertion anchor not found")
auth = auth.replace(anchor, native_effect, 1)

old_google = '''    const signInWithGoogle = async (returnTo?: string) => {
      const client = supabase;
      if (!client) {
        return { error: unavailableReason ?? "Auth unavailable" };
      }

      const safeReturnTo = sanitizeAuthReturnTo(returnTo, "/more");
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("returnTo", safeReturnTo);

      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (error) return { error: error.message };
      return { error: null };
    };'''
new_google = '''    const signInWithGoogle = async (returnTo?: string) => {
      const client = supabase;
      if (!client) {
        return { error: unavailableReason ?? "Auth unavailable" };
      }

      const safeReturnTo = sanitizeAuthReturnTo(returnTo, "/more");
      const native = isNativeApp();
      const callbackUrl = buildAuthCallbackUrl(safeReturnTo, "oauth");
      const { data, error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
          skipBrowserRedirect: native,
        },
      });

      if (error) return { error: error.message };
      if (!native) return { error: null };
      if (!data.url) return { error: "Google sign-in URL was not created." };

      try {
        window.sessionStorage.removeItem("rawaj:native-auth:last-callback");
        await openNativeAuthBrowser(data.url);
        return { error: null };
      } catch (browserError) {
        return {
          error:
            browserError instanceof Error
              ? browserError.message
              : "Could not open Google sign-in.",
        };
      }
    };'''
if old_google not in auth:
    raise SystemExit("Google sign-in block not found")
auth_path.write_text(auth.replace(old_google, new_google, 1))

login_path = Path("src/routes/login.tsx")
login = login_path.read_text()
login = login.replace(
    'import { sanitizeAuthReturnTo } from "@/lib/auth-return";\n',
    'import { sanitizeAuthReturnTo } from "@/lib/auth-return";\nimport { buildAuthCallbackUrl } from "@/lib/native-auth";\n',
    1,
)
login = login.replace(
    '  const [error, setError] = useState("");\n',
    '''  const [error, setError] = useState(
    looseSearch.authError === "native_callback_failed"
      ? text(
          "تعذر إكمال تسجيل الدخول داخل التطبيق. حاول مرة أخرى.",
          "Could not complete sign-in inside the app. Please try again.",
        )
      : "",
  );
''',
    1,
)
login = login.replace(
    '''      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("type", "recovery");
      callbackUrl.searchParams.set("returnTo", returnTo);
      const { error: resetError } = await client.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: callbackUrl.toString(),
      });''',
    '''      const callbackUrl = buildAuthCallbackUrl(returnTo, "recovery");
      const { error: resetError } = await client.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: callbackUrl,
      });''',
    1,
)
login = login.replace(
    '            options: { data: { display_name: cleanName } },',
    '''            options: {
              data: { display_name: cleanName },
              emailRedirectTo: buildAuthCallbackUrl(returnTo, "confirmation"),
            },''',
    1,
)
login_path.write_text(login)

package_path = Path("package.json")
package = json.loads(package_path.read_text())
package["scripts"]["test:native-mobile-auth"] = "node --test scripts/native-mobile-auth.test.mjs"
if "npm run test:native-mobile-auth" not in package["scripts"]["check"]:
    package["scripts"]["check"] = package["scripts"]["check"].replace(
        "npm run test:auth-recovery &&",
        "npm run test:auth-recovery && npm run test:native-mobile-auth &&",
    )
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n")

quality_path = Path(".github/workflows/quality-gate.yml")
quality = quality_path.read_text()
if "Native mobile authentication contract" not in quality:
    quality = quality.replace(
        '''      - name: Authentication recovery contract
        run: node --test scripts/auth-recovery.test.mjs

''',
        '''      - name: Authentication recovery contract
        run: node --test scripts/auth-recovery.test.mjs

      - name: Native mobile authentication contract
        run: npm run test:native-mobile-auth

''',
        1,
    )
quality_path.write_text(quality)

Path("scripts/native-mobile-auth.test.mjs").write_text('''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [packageJson, nativeAuth, auth, login, supabase, manifest, strings, buildGradle] =
  await Promise.all([
    readFile("package.json", "utf8"),
    readFile("src/lib/native-auth.ts", "utf8"),
    readFile("src/lib/auth.tsx", "utf8"),
    readFile("src/routes/login.tsx", "utf8"),
    readFile("src/lib/supabase.ts", "utf8"),
    readFile("android/app/src/main/AndroidManifest.xml", "utf8"),
    readFile("android/app/src/main/res/values/strings.xml", "utf8"),
    readFile("android/app/build.gradle", "utf8"),
  ]);

test("native OAuth uses official Capacitor app and browser plugins", () => {
  const pkg = JSON.parse(packageJson);
  assert.equal(pkg.dependencies["@capacitor/app"], "8.1.0");
  assert.equal(pkg.dependencies["@capacitor/browser"], "8.0.3");
  assert.match(nativeAuth, /App\\.addListener\\("appUrlOpen"/);
  assert.match(nativeAuth, /App\\.getLaunchUrl\\(\\)/);
  assert.match(nativeAuth, /Browser\\.open\\(\\{ url \\}\\)/);
});

test("OAuth callback creates and persists the Supabase session", () => {
  assert.match(supabase, /flowType: "pkce"/);
  assert.match(nativeAuth, /exchangeCodeForSession\\(code\\)/);
  assert.match(nativeAuth, /client\\.auth\\.setSession/);
  assert.match(auth, /skipBrowserRedirect: native/);
  assert.match(auth, /completeNativeAuthCallback/);
  assert.match(auth, /nativeAuthCallbackFingerprint/);
});

test("Android callback intent is narrow and matches the callback builder", () => {
  assert.match(strings, /<string name="custom_url_scheme">com\\.rawaj\\.marketplace<\\/string>/);
  assert.match(manifest, /android:scheme="@string\\/custom_url_scheme"/);
  assert.match(manifest, /android:host="auth"/);
  assert.match(manifest, /android:path="\\/callback"/);
  assert.match(nativeAuth, /com\\.rawaj\\.marketplace/);
  assert.match(nativeAuth, /nativeAuthHost = "auth"/);
  assert.match(nativeAuth, /nativeAuthPath = "\\/callback"/);
});

test("recovery and confirmation links return to the installed app", () => {
  assert.match(login, /buildAuthCallbackUrl\\(returnTo, "recovery"\\)/);
  assert.match(login, /emailRedirectTo: buildAuthCallbackUrl\\(returnTo, "confirmation"\\)/);
  assert.match(auth, /completion\\.kind === "recovery"/);
});

test("release identity remains 1.0.3 code 4 during the audit", () => {
  assert.match(buildGradle, /versionCode 4/);
  assert.match(buildGradle, /versionName "1\\.0\\.3"/);
});
''')
