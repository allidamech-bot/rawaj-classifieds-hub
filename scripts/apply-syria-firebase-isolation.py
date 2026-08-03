from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def write(relative: str, content: str) -> None:
    (ROOT / relative).write_text(content, encoding="utf-8")


write(
    "src/lib/firebase.ts",
    '''import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseAppName = "rawaj-syria";

const configuredFirebase = {
  apiKey: import.meta.env.VITE_SYRIA_FIREBASE_API_KEY?.trim() ?? "",
  authDomain: import.meta.env.VITE_SYRIA_FIREBASE_AUTH_DOMAIN?.trim() ?? "",
  projectId: import.meta.env.VITE_SYRIA_FIREBASE_PROJECT_ID?.trim() ?? "",
  messagingSenderId: import.meta.env.VITE_SYRIA_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? "",
  appId: import.meta.env.VITE_SYRIA_FIREBASE_APP_ID?.trim() ?? "",
};

export const firebaseAuthAvailable = Object.values(configuredFirebase).every(Boolean);

const firebaseConfig = firebaseAuthAvailable
  ? configuredFirebase
  : {
      apiKey: "rawaj-syria-auth-pending",
      authDomain: "rawaj-syria-auth-pending.firebaseapp.com",
      projectId: "rawaj-syria-auth-pending",
      messagingSenderId: "0",
      appId: "1:0:web:rawaj-syria-auth-pending",
    };

const app =
  getApps().find((candidate) => candidate.name === firebaseAppName) ??
  initializeApp(firebaseConfig, firebaseAppName);

export const firebaseAuth = getAuth(app);
''',
)

auth_path = ROOT / "src/lib/auth.tsx"
auth = auth_path.read_text(encoding="utf-8")
auth, import_count = re.subn(
    r'import \{ firebaseAuth(?:, firebaseAuthAvailable)? \} from "\./firebase";',
    'import { firebaseAuth, firebaseAuthAvailable } from "./firebase";',
    auth,
    count=1,
)
if import_count != 1:
    raise SystemExit("Expected Firebase auth import was not replaced")

auth, state_count = re.subn(
    r'  const \[status, setStatus\] = useState<AuthStatus>\((?:"loading"|\n\s*firebaseAuthAvailable \? "loading" : "authUnavailable",\n\s*)\);',
    '  const [status, setStatus] = useState<AuthStatus>(\n    firebaseAuthAvailable ? "loading" : "authUnavailable",\n  );',
    auth,
    count=1,
)
if state_count != 1:
    raise SystemExit("Expected auth status state was not replaced")

listener_pattern = re.compile(
    r'''  useEffect\(\(\) => \{\n(?:    if \(!firebaseAuthAvailable\) \{[\s\S]*?    \}\n\n)?    const unsubscribe = onIdTokenChanged\(firebaseAuth, \(nextUser\) => \{\n      queueMicrotask\(\(\) => void applyFirebaseUser\(nextUser\)\);\n    \}\);\n    return unsubscribe;\n  \}, \[applyFirebaseUser\]\);'''
)
listener_replacement = '''  useEffect(() => {
    if (!firebaseAuthAvailable) {
      setSession(null);
      setProfile(null);
      setStatus("authUnavailable");
      setReason("تسجيل الدخول السوري غير مهيأ في بيئة النشر.");
      return;
    }

    const unsubscribe = onIdTokenChanged(firebaseAuth, (nextUser) => {
      queueMicrotask(() => void applyFirebaseUser(nextUser));
    });
    return unsubscribe;
  }, [applyFirebaseUser]);'''
auth, listener_count = listener_pattern.subn(listener_replacement, auth, count=1)
if listener_count != 1:
    raise SystemExit("Expected Firebase listener effect was not replaced")
auth_path.write_text(auth, encoding="utf-8")

write(
    ".env.example",
    '''# Public application data, uploads, and marketplace APIs are served by the Syria Cloudflare Worker.
VITE_PUBLIC_DATA_PROVIDER=cloudflare
VITE_PUBLIC_DATA_API_BASE_URL=https://rawaj-classifieds-hub.allidamech.workers.dev

# Public Syria origin for canonical URLs, Open Graph, Twitter cards, JSON-LD, and auth links.
VITE_SITE_URL=https://rawa-j.com

# Syria Firebase Web application. Install real values in Vercel/provider environments only.
VITE_SYRIA_FIREBASE_API_KEY=
VITE_SYRIA_FIREBASE_AUTH_DOMAIN=
VITE_SYRIA_FIREBASE_PROJECT_ID=
VITE_SYRIA_FIREBASE_MESSAGING_SENDER_ID=
VITE_SYRIA_FIREBASE_APP_ID=

# The Worker must verify tokens against the same Syria Firebase project ID.
SYRIA_FIREBASE_PROJECT_ID=

# Server-only, comma/newline-separated SHA-256 fingerprints from the Play App Signing
# certificate. Android remains the existing single RAWAJ application and is not split here.
RAWAJ_ANDROID_SHA256_CERT_FINGERPRINTS=
''',
)

wrangler_path = ROOT / "cloudflare/worker/wrangler.base.jsonc"
wrangler = json.loads(wrangler_path.read_text(encoding="utf-8"))
wrangler.setdefault("vars", {}).pop("FIREBASE_PROJECT_ID", None)
wrangler_path.write_text(json.dumps(wrangler, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

render_path = ROOT / "cloudflare/worker/scripts/render-config.mjs"
render = render_path.read_text(encoding="utf-8")
old_binding = '''const d1DatabaseId = local
  ? "00000000-0000-0000-0000-000000000000"
  : process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
const r2BucketName = local ? "rawaj-media-local" : process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim();

if (!d1DatabaseId || !r2BucketName) {
  console.error(
    "Missing required production Cloudflare configuration: CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_R2_BUCKET_NAME",
  );
  process.exit(1);
}'''
new_binding = '''const d1DatabaseId = local
  ? "00000000-0000-0000-0000-000000000000"
  : process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
const r2BucketName = local ? "rawaj-media-local" : process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim();
const firebaseProjectId = local
  ? "rawaj-syria-auth-pending"
  : process.env.SYRIA_FIREBASE_PROJECT_ID?.trim();

if (!d1DatabaseId || !r2BucketName || !firebaseProjectId) {
  console.error(
    "Missing required Syria production configuration: CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_R2_BUCKET_NAME, SYRIA_FIREBASE_PROJECT_ID",
  );
  process.exit(1);
}

if (!local && firebaseProjectId === "rawaj-syria-auth-pending") {
  console.error("A configured Syria Firebase project is required for production rendering.");
  process.exit(1);
}'''
if old_binding in render:
    render = render.replace(old_binding, new_binding)
elif new_binding not in render:
    raise SystemExit("Expected Worker binding block was not found")

old_vars = '''    API_ALLOWED_ORIGINS: local ? localOrigins : officialOrigins,
    RAWAJ_WORKER_RELEASE_SHA: releaseSha,'''
new_vars = '''    API_ALLOWED_ORIGINS: local ? localOrigins : officialOrigins,
    FIREBASE_PROJECT_ID: firebaseProjectId,
    RAWAJ_WORKER_RELEASE_SHA: releaseSha,'''
if old_vars in render:
    render = render.replace(old_vars, new_vars)
elif new_vars not in render:
    raise SystemExit("Expected Worker generated vars block was not found")
render_path.write_text(render, encoding="utf-8")

write(
    "scripts/syria-firebase-isolation.test.mjs",
    '''import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const firebase = read("src/lib/firebase.ts");
const auth = read("src/lib/auth.tsx");
const environment = read(".env.example");
const workerBase = read("cloudflare/worker/wrangler.base.jsonc");
const workerRender = read("cloudflare/worker/scripts/render-config.mjs");

test("Syria Web Firebase configuration is environment-owned and fail-closed", () => {
  for (const name of [
    "VITE_SYRIA_FIREBASE_API_KEY",
    "VITE_SYRIA_FIREBASE_AUTH_DOMAIN",
    "VITE_SYRIA_FIREBASE_PROJECT_ID",
    "VITE_SYRIA_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_SYRIA_FIREBASE_APP_ID",
  ]) {
    assert.match(firebase, new RegExp(name));
    assert.match(environment, new RegExp(`^${name}=$`, "m"));
  }
  assert.match(firebase, /firebaseAppName = "rawaj-syria"/);
  assert.match(firebase, /rawaj-syria-auth-pending/);
  assert.match(firebase, /firebaseAuthAvailable/);
  assert.doesNotMatch(firebase, /AIza[0-9A-Za-z_-]{20,}/);
  assert.doesNotMatch(firebase, /project-af18fcaf-c46e-4ec5-93a/);
  assert.doesNotMatch(firebase, /165848071823/);
});

test("authentication UI stops safely when Syria Firebase is not configured", () => {
  assert.match(auth, /firebaseAuth, firebaseAuthAvailable/);
  assert.match(auth, /firebaseAuthAvailable \? "loading" : "authUnavailable"/);
  assert.match(auth, /if \(!firebaseAuthAvailable\)/);
  assert.match(auth, /تسجيل الدخول السوري غير مهيأ في بيئة النشر/);
});

test("Worker Firebase verification uses the protected Syria project variable", () => {
  assert.doesNotMatch(workerBase, /FIREBASE_PROJECT_ID/);
  assert.match(workerRender, /SYRIA_FIREBASE_PROJECT_ID/);
  assert.match(workerRender, /FIREBASE_PROJECT_ID: firebaseProjectId/);
  assert.match(workerRender, /rawaj-syria-auth-pending/);
  assert.match(environment, /^SYRIA_FIREBASE_PROJECT_ID=$/m);
});
''',
)

print("Applied Syria Firebase isolation changes.")
