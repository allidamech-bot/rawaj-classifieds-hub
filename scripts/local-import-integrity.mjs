import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SOURCE_ROOT = resolve(ROOT, "src");
const roots = ["src", "cloudflare/worker/src", "scripts"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const candidates = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.jsx",
  "/index.mjs",
  "/index.cjs",
];

const files = [];
for (const root of roots) files.push(...(await walk(root)));

const missing = [];
for (const path of files) {
  const source = await readFile(resolve(ROOT, path), "utf8");
  for (const specifier of extractSpecifiers(source)) {
    const base = resolveLocalSpecifier(path, specifier);
    if (!base) continue;
    if (!(await resolves(base))) missing.push({ path, specifier });
  }
}

console.log(
  JSON.stringify(
    {
      scannedFiles: files.length,
      missingImports: missing.length,
      missing,
    },
    null,
    2,
  ),
);

if (missing.length > 0) process.exitCode = 1;

function resolveLocalSpecifier(importer, specifier) {
  const clean = specifier.split("?", 1)[0].split("#", 1)[0];
  if (clean.startsWith("@/")) return resolve(SOURCE_ROOT, clean.slice(2));
  if (clean.startsWith("./") || clean.startsWith("../")) {
    return resolve(dirname(resolve(ROOT, importer)), clean);
  }
  return null;
}

async function resolves(base) {
  for (const suffix of candidates) {
    try {
      await access(`${base}${suffix}`);
      return true;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return false;
}

function extractSpecifiers(source) {
  const output = new Set();
  const patterns = [
    /^\s*(?:import|export)\s+(?:type\s+)?[^;]*?\s+from\s+["']([^"']+)["']/gm,
    /^\s*import\s*["']([^"']+)["']/gm,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) output.add(match[1]);
  }
  return output;
}

async function walk(relativeDirectory) {
  const absolute = resolve(ROOT, relativeDirectory);
  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const output = [];
  for (const entry of entries) {
    if (["node_modules", ".git", "dist", "build", ".output"].includes(entry.name)) continue;
    const absolutePath = resolve(absolute, entry.name);
    const path = relative(ROOT, absolutePath).replaceAll("\\", "/");
    if (entry.isDirectory()) output.push(...(await walk(path)));
    else if (sourceExtensions.has(extname(entry.name))) output.push(path);
  }
  return output;
}
