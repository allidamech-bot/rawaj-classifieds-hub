import { readFileSync, writeFileSync } from "node:fs";

const path = "src/features/notifications/NotificationPreferencesPanel.tsx";
let source = readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  if (source.includes(to)) return;
  const first = source.indexOf(from);
  const last = source.lastIndexOf(from);
  if (first === -1 || first !== last) {
    throw new Error(`${label}: expected exactly one source match`);
  }
  source = source.slice(0, first) + to + source.slice(first + from.length);
}

replaceOnce(
  `  const requestIdRef = useRef(0);\n  const profileId = auth.profile?.id ?? null;`,
  `  const requestIdRef = useRef(0);\n  const loadedProfileIdRef = useRef<string | null>(null);\n  const profileId = auth.profile?.id ?? null;`,
  "loaded profile ref",
);

replaceOnce(
  `      requestIdRef.current += 1;\n      setPreferences(null);`,
  `      requestIdRef.current += 1;\n      loadedProfileIdRef.current = null;\n      setPreferences(null);`,
  "signed-out loaded profile reset",
);

replaceOnce(
  `    const requestId = ++requestIdRef.current;\n    setLoading(true);`,
  `    if (loadedProfileIdRef.current !== profileId) {\n      requestIdRef.current += 1;\n      loadedProfileIdRef.current = profileId;\n      setPreferences(null);\n      setPushCapability({ available: false, platform: "web" });\n      setPushStatus(EMPTY_PUSH_STATUS);\n      setSavingKey(null);\n      setPushBusy(false);\n      setError("");\n      setPushMessage("");\n    }\n\n    const requestId = ++requestIdRef.current;\n    setLoading(true);`,
  "signed-in account transition reset",
);

writeFileSync(path, source);
console.log("Notification preference account reset applied.");
