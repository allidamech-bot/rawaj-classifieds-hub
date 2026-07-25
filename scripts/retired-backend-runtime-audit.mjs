import { access, readFile, readdir } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VENDOR = "supabase";
const VENDOR_PACKAGE = `@${VENDOR}/${VENDOR}-js`;
const REPORT_ONLY = process.argv.includes("--report-only");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const TEXT_EXTENSIONS = new Set([
  ...SOURCE_EXTENSIONS,
  ".json",
  ".jsonc",
  ".md",
  ".yml",
  ".yaml",
  ".toml",
  ".sql",
  ".txt",
]);

const forbiddenPaths = [
  VENDOR,
  `${VENDOR}-runtime-inventory.json`,
  `${VENDOR}-runtime-inventory-v2.json`,
  "cloudflare/migration",
  `src/lib/${VENDOR}.ts`,
  "src/lib/auth-recovery-session.ts",
  "src/lib/api/account-identity.ts",
];

const immutableHistoricalFiles = new Set([
  "cloudflare/d1/migrations/0005_legacy_media_migration_tracking.sql",
  `cloudflare/d1/migrations/0006_${VENDOR}_auth_identity.sql`,
  "cloudflare/d1/migrations/0015_retire_legacy_auth_provider.sql",
]);

const evidenceFiles = new Set([
  "scripts/retired-backend-runtime-audit.mjs",
  "scripts/cloudflare-runtime-cleanup.test.mjs",
  "scripts/admin-security-regression.mjs",
]);

const runtimeRoots = ["src", "cloudflare/worker/src"];
const manifestFiles = [
  "package.json",
  "package-lock.json",
  "cloudflare/worker/package.json",
  "cloudflare/worker/package-lock.json",
];
const environmentFiles = [".env", ".env.example", ".env.production"];

const findings = [];
const allowedReferences = [];
let scannedFiles = 0;

for (const path of forbiddenPaths) {
  if (await exists(path)) {
    findings.push({ path, line: 1, rule: "forbidden-retired-backend-path" });
  }
}

for (const path of [...manifestFiles, ...environmentFiles]) {
  if (!(await exists(path))) continue;
  const content = await read(path);
  scannedFiles += 1;
  collect(content, path, [
    ["retired-sdk-package", new RegExp(escapeRegex(VENDOR_PACKAGE), "gi")],
    [
      "retired-environment-variable",
      new RegExp(`\\b(?:VITE_)?${VENDOR.toUpperCase()}_[A-Z0-9_]+\\b`, "g"),
    ],
    ["retired-service-host", new RegExp(`https?:\\/\\/[^\\s\"']*${VENDOR}\\.(?:co|com)`, "gi")],
  ]);
}

for (const root of runtimeRoots) {
  if (!(await exists(root))) continue;
  for (const path of await walk(root, SOURCE_EXTENSIONS)) {
    const content = await read(path);
    scannedFiles += 1;
    collect(content, path, [
      ["retired-sdk-import", new RegExp(escapeRegex(VENDOR_PACKAGE), "gi")],
      ["retired-client-module", new RegExp(`(?:@\\/lib\\/${VENDOR}|lib\\/${VENDOR})`, "gi")],
      ["retired-client-construction", /\bcreateClient\s*\(/g],
      ["retired-client-type", new RegExp(`\\b${capitalize(VENDOR)}Client\\b`, "g")],
      [
        "retired-environment-variable",
        new RegExp(`\\b(?:VITE_)?${VENDOR.toUpperCase()}_[A-Z0-9_]+\\b`, "g"),
      ],
      ["retired-service-host", new RegExp(`https?:\\/\\/[^\\s\"']*${VENDOR}\\.(?:co|com)`, "gi")],
      ["retired-realtime-channel", /\.channel\s*\(/g],
    ]);

    if (hasRetiredClientMarker(content)) {
      collect(content, path, [
        ["retired-database-transport", /\.(?:from|rpc)\s*\(/g],
        ["retired-storage-transport", /\.storage(?:\.|\[)/g],
      ]);
    }
  }
}

for (const path of await walk(".", TEXT_EXTENSIONS)) {
  if (path.startsWith(".git/") || path.startsWith("node_modules/")) continue;
  if (immutableHistoricalFiles.has(path) || isEvidenceFile(path)) {
    const content = await read(path);
    const count = countMatches(content, new RegExp(VENDOR, "gi"));
    if (count > 0) allowedReferences.push({ path, count });
    continue;
  }

  const content = await read(path);
  const regex = new RegExp(`\\b${VENDOR}\\b`, "gi");
  for (const match of content.matchAll(regex)) {
    findings.push({
      path,
      line: lineAt(content, match.index ?? 0),
      rule: "retired-backend-reference-outside-evidence",
    });
  }
}

const uniqueFindings = dedupe(findings);
const runtimeFindings = uniqueFindings.filter((item) =>
  runtimeRoots.some((root) => item.path === root || item.path.startsWith(`${root}/`)),
);

const report = {
  scannedFiles,
  totalFindings: uniqueFindings.length,
  runtimeFindings: runtimeFindings.length,
  repositoryFindings: uniqueFindings.length - runtimeFindings.length,
  allowedHistoricalReferences: allowedReferences,
  findings: uniqueFindings,
};

console.log(JSON.stringify(report, null, 2));

if (!REPORT_ONLY && uniqueFindings.length > 0) process.exitCode = 1;

function hasRetiredClientMarker(content) {
  return (
    new RegExp(escapeRegex(VENDOR_PACKAGE), "i").test(content) ||
    new RegExp(`@/lib/${VENDOR}`, "i").test(content) ||
    new RegExp(`\\b${capitalize(VENDOR)}Client\\b`).test(content) ||
    new RegExp(`\\b(?:public${capitalize(VENDOR)}|${VENDOR})\\b`, "i").test(content)
  );
}

function isEvidenceFile(path) {
  return (
    evidenceFiles.has(path) ||
    (path.startsWith("scripts/") && /(?:\.test\.|-cutover\.test\.)/.test(path))
  );
}

function collect(content, path, rules) {
  for (const [rule, regex] of rules) {
    regex.lastIndex = 0;
    for (const match of content.matchAll(regex)) {
      findings.push({ path, line: lineAt(content, match.index ?? 0), rule });
    }
  }
}

function countMatches(content, regex) {
  regex.lastIndex = 0;
  return [...content.matchAll(regex)].length;
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
    ) {
      continue;
    }
    const absolutePath = resolve(absoluteDirectory, entry.name);
    const path = relative(ROOT, absolutePath).replaceAll("\\", "/");
    if (entry.isDirectory()) output.push(...(await walk(path, extensions)));
    else if (extensions.has(extname(entry.name)) || environmentFiles.includes(path))
      output.push(path);
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

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
