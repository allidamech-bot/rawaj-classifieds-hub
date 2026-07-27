import { access, readFile, readdir } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPORT_ONLY = process.argv.includes("--report-only");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const runtimeRoots = ["src", "cloudflare/worker/src"];
const allowedSupabaseAuthFiles = new Set([
  "src/lib/supabase-auth.ts",
  "src/lib/auth-context.ts",
  "src/lib/auth-recovery-session.ts",
  "src/lib/auth.tsx",
  "src/lib/cloudflare-auth.ts",
  "src/lib/native-push.ts",
  "src/lib/api/account-security.ts",
  "src/routes/auth.callback.tsx",
  "src/routes/reset-password.tsx",
  "cloudflare/worker/src/auth.ts",
]);
const forbiddenPaths = [
  "supabase",
  "supabase-runtime-inventory.json",
  "supabase-runtime-inventory-v2.json",
  "cloudflare/migration",
  "src/lib/supabase.ts",
  "src/lib/api/account-identity.ts",
];

const findings = [];
let scannedFiles = 0;

for (const path of forbiddenPaths) {
  if (await exists(path)) findings.push({ path, line: 1, rule: "forbidden-retired-data-path" });
}

for (const root of runtimeRoots) {
  if (!(await exists(root))) continue;
  for (const path of await walk(root, SOURCE_EXTENSIONS)) {
    const content = await read(path);
    scannedFiles += 1;
    collect(content, path, [
      ["firebase-runtime-reference", /firebase(?:\/auth|Auth|_AUTH|_PROJECT|\.googleapis)/gi],
    ]);

    const referencesSupabaseClient =
      /@supabase\/supabase-js|@\/lib\/supabase-auth|\bsupabaseAuth\b/.test(content);
    if (referencesSupabaseClient) {
      collect(content, path, [
        [
          "retired-supabase-data-transport",
          /\.from\s*\(|\.rpc\s*\(|\.storage(?:\.|\[)|\.channel\s*\(/g,
        ],
      ]);
    }

    if (path.startsWith("src/") && !allowedSupabaseAuthFiles.has(path)) {
      collect(content, path, [
        [
          "supabase-auth-outside-boundary",
          /@supabase\/supabase-js|@\/lib\/supabase-auth|\bsupabaseAuth\b|VITE_SUPABASE_/g,
        ],
      ]);
    }
  }
}

for (const path of [".env", ".env.example", ".env.production"]) {
  if (!(await exists(path))) continue;
  const content = await read(path);
  scannedFiles += 1;
  collect(content, path, [
    ["privileged-supabase-secret", /SUPABASE_(?:SERVICE_ROLE|SECRET|JWT_SECRET)/g],
    ["firebase-environment-variable", /(?:VITE_)?FIREBASE_[A-Z0-9_]+/g],
  ]);
}

const packageSource = await read("package.json");
const packageJson = JSON.parse(packageSource);
if (!packageJson.dependencies?.["@supabase/supabase-js"]) {
  findings.push({ path: "package.json", line: 1, rule: "missing-supabase-auth-sdk" });
}
if (packageJson.dependencies?.firebase || packageJson.devDependencies?.["firebase-admin"]) {
  findings.push({ path: "package.json", line: 1, rule: "firebase-sdk-not-retired" });
}

const uniqueFindings = dedupe(findings);
console.log(
  JSON.stringify(
    {
      scannedFiles,
      totalFindings: uniqueFindings.length,
      findings: uniqueFindings,
      boundary: "Supabase Auth only; Cloudflare D1/R2 for application data and media",
    },
    null,
    2,
  ),
);
if (!REPORT_ONLY && uniqueFindings.length > 0) process.exitCode = 1;

function collect(content, path, rules) {
  for (const [rule, regex] of rules) {
    regex.lastIndex = 0;
    for (const match of content.matchAll(regex)) {
      findings.push({ path, line: lineAt(content, match.index ?? 0), rule });
    }
  }
}

function lineAt(content, index) {
  return content.slice(0, index).split("\n").length;
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.path}:${item.line}:${item.rule}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function walk(relativeDirectory, extensions) {
  const absoluteDirectory = resolve(ROOT, relativeDirectory);
  const output = [];
  let entries;
  try {
    entries = await readdir(absoluteDirectory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return output;
    throw error;
  }
  for (const entry of entries) {
    if (
      [".git", "node_modules", "dist", "build", ".output", ".wrangler", ".tanstack"].includes(
        entry.name,
      )
    )
      continue;
    const absolutePath = resolve(absoluteDirectory, entry.name);
    const path = relative(ROOT, absolutePath).replaceAll("\\", "/");
    if (entry.isDirectory()) output.push(...(await walk(path, extensions)));
    else if (extensions.has(extname(entry.name))) output.push(path);
  }
  return output;
}

async function exists(path) {
  try {
    await access(resolve(ROOT, path));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function read(path) {
  return readFile(resolve(ROOT, path), "utf8");
}
