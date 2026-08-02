import fs from "node:fs";

function replaceRequired(file, before, after) {
  const source = fs.readFileSync(file, "utf8");
  if (source.includes(after)) {
    console.log(`Already applied: ${file}`);
    return;
  }
  if (!source.includes(before)) {
    throw new Error(`Required source block not found in ${file}`);
  }
  fs.writeFileSync(file, source.replace(before, after));
  console.log(`Updated: ${file}`);
}

replaceRequired(
  "src/lib/auth.tsx",
  'import { firebaseAuth } from "./firebase";',
  'import { firebaseAuth, firebaseAuthAvailable } from "./firebase";',
);

replaceRequired(
  "src/lib/auth.tsx",
  '  const [status, setStatus] = useState<AuthStatus>("loading");',
  '  const [status, setStatus] = useState<AuthStatus>(\n    firebaseAuthAvailable ? "loading" : "authUnavailable",\n  );',
);

replaceRequired(
  "src/lib/auth.tsx",
  `  useEffect(() => {
    const unsubscribe = onIdTokenChanged(firebaseAuth, (nextUser) => {
      queueMicrotask(() => void applyFirebaseUser(nextUser));
    });
    return unsubscribe;
  }, [applyFirebaseUser]);`,
  `  useEffect(() => {
    if (!firebaseAuthAvailable) {
      setSession(null);
      setProfile(null);
      setStatus("authUnavailable");
      setReason("تسجيل الدخول السعودي قيد التفعيل.");
      return;
    }

    const unsubscribe = onIdTokenChanged(firebaseAuth, (nextUser) => {
      queueMicrotask(() => void applyFirebaseUser(nextUser));
    });
    return unsubscribe;
  }, [applyFirebaseUser]);`,
);

const serverFile = "src/server.ts";
const serverBefore = fs.readFileSync(serverFile, "utf8");
const serverAfter = serverBefore.replaceAll(
  "https://project-af18fcaf-c46e-4ec5-93a.firebaseapp.com",
  "https://*.firebaseapp.com https://*.web.app",
);
if (serverAfter === serverBefore) {
  if (!serverBefore.includes("https://*.firebaseapp.com")) {
    throw new Error("Saudi Firebase CSP source was not found.");
  }
} else {
  fs.writeFileSync(serverFile, serverAfter);
  console.log(`Updated: ${serverFile}`);
}

const envFile = ".env.example";
const envSource = fs.readFileSync(envFile, "utf8");
if (!envSource.includes("VITE_SAUDI_FIREBASE_API_KEY")) {
  const block = `
# Saudi Firebase web app (required before enabling Saudi account actions)
VITE_SAUDI_FIREBASE_API_KEY=
VITE_SAUDI_FIREBASE_AUTH_DOMAIN=
VITE_SAUDI_FIREBASE_PROJECT_ID=
VITE_SAUDI_FIREBASE_MESSAGING_SENDER_ID=
VITE_SAUDI_FIREBASE_APP_ID=
`;
  fs.writeFileSync(envFile, `${envSource.trimEnd()}\n${block}`);
  console.log(`Updated: ${envFile}`);
}
