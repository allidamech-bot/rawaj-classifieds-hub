import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const ROOT = new URL("../", import.meta.url);
const SCAN_ROOTS = ["src", "cloudflare/worker/src"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const patterns = [
  { id: "supabase-package-runtime-import", regex: /import\s+(?!type\b)[^;]*from\s+["']@supabase\/supabase-js["']/g },
  { id: "supabase-client-import", regex: /from\s+["']@\/lib\/supabase["']/g },
  { id: "supabase-client-construction", regex: /\bcreateClient\s*\(/g },
  { id: "supabase-env", regex: /\b(?:VITE_)?SUPABASE_[A-Z0-9_]+\b/g },
  { id: "supabase-host", regex: /https:\/\/[^\s"']+\.supabase\.co/gi },
  { id: "postgrest-runtime", regex: /\.(?:from|rpc)\s*\(/g },
  { id: "supabase-storage-runtime", regex: /\.storage(?:\.|\[)/g },
];

const intentionalCompatibilityFiles = new Set([
  "src/lib/supabase.ts",
  "src/lib/api/shared.ts",
]);

const files = [];
for (const root of SCAN_ROOTS) await walk(new URL(`${root}/`, ROOT), files);

const findings = [];
for (const url of files) {
  const path = relative(new URL(".", ROOT).pathname, url.pathname).replaceAll("\\", "/").replace(/^\//, "");
  const content = await readFile(url, "utf8");
  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    for (const match of content.matchAll(pattern.regex)) {
      const line = content.slice(0, match.index).split("\n").length;
      findings.push({
        path,
        line,
        rule: pattern.id,
        compatibilityOnly: intentionalCompatibilityFiles.has(path),
        excerpt: String(match[0]).replace(/\s+/g, " ").slice(0, 160),
      });
    }
  }
}

const runtimeFindings = findings.filter((item) => !item.compatibilityOnly);
const grouped = Object.groupBy(runtimeFindings, (item) => item.path);

console.log(JSON.stringify({
  scannedFiles: files.length,
  totalFindings: findings.length,
  runtimeFindings: runtimeFindings.length,
  compatibilityFindings: findings.length - runtimeFindings.length,
  files: Object.entries(grouped).map(([path, items]) => ({ path, findings: items })),
}, null, 2));

if (process.argv.includes("--strict") && runtimeFindings.length > 0) process.exitCode = 1;

async function walk(directoryUrl, output) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  for (const entry of entries) {
    if (["node_modules", ".git", "dist", "build", ".output"].includes(entry.name)) continue;
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directoryUrl);
    if (entry.isDirectory()) await walk(child, output);
    else if (EXTENSIONS.has(extname(entry.name))) output.push(child);
  }
}
