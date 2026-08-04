import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SCANNED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".jsonc",
  ".yml",
  ".yaml",
  ".sh",
]);
const SCAN_ROOTS = ["src", "cloudflare/worker/src", ".github/workflows", "scripts"];
const CONFIGURATION_FILES = [
  ".env",
  ".env.example",
  ".env.production",
  "package.json",
  "vercel.json",
  "vite.config.ts",
  "capacitor.config.ts",
  "cloudflare/worker/wrangler.base.jsonc",
  "cloudflare/worker/scripts/render-config.mjs",
  "cloudflare/worker/package.json",
];
const EXCLUDED_FILES = new Set(["scripts/syria-market-isolation.test.mjs"]);
const FORBIDDEN_FOREIGN_MARKERS = [
  ["Saudi Worker or project identifier", /rawaj-saudi/i],
  ["Saudi public host", /sa\.rawa-j\.com/i],
  ["Saudi environment namespace", /\b(?:VITE_)?SAUDI_[A-Z0-9_]+\b/i],
  ["Saudi English market label", /\bSaudi(?: Arabia)?\b/i],
  ["Saudi Arabic market label", /السعودية/],
  ["embedded cross-market gateway", /rawaj-market-gateway/i],
];

const operationalFiles = [
  ...CONFIGURATION_FILES,
  ...(await Promise.all(SCAN_ROOTS.map((root) => walk(root)))).flat(),
].filter((path, index, items) => !EXCLUDED_FILES.has(path) && items.indexOf(path) === index);

test("Syria repository has no embedded Saudi or gateway runtime", async () => {
  assert.equal(await pathExists("src/market-server.ts"), false, "Saudi host proxy must stay absent");
  const remainingGatewayFiles = await walkAll("rawaj-market-gateway");
  assert.deepEqual(
    remainingGatewayFiles,
    [],
    `the independent gateway must not be embedded in the Syria repository: ${remainingGatewayFiles.join(", ")}`,
  );

  for (const path of operationalFiles) {
    const content = await read(path);
    for (const [label, pattern] of FORBIDDEN_FOREIGN_MARKERS) {
      assert.doesNotMatch(content, pattern, `${path} contains ${label}`);
    }
  }
});

test("Syria SSR and frontend API stay pinned to Syria services", async () => {
  const vite = await read("vite.config.ts");
  const vercel = await read("vercel.json");
  const wrangler = await read("cloudflare/worker/wrangler.base.jsonc");

  assert.match(vite, /server:\s*\{\s*entry:\s*["']server["']\s*\}/);
  assert.doesNotMatch(vite, /market-server/);
  assert.match(
    vercel,
    /https:\/\/rawaj-classifieds-hub\.allidamech\.workers\.dev\/v1\/\:path\*/,
  );
  assert.match(
    vercel,
    /https:\/\/rawaj-classifieds-hub\.allidamech\.workers\.dev\/api\/\:path\*/,
  );
  assert.match(wrangler, /"name":\s*"rawaj-classifieds-hub"/);
  assert.match(wrangler, /"FIREBASE_PROJECT_ID":\s*"project-af18fcaf-c46e-4ec5-93a"/);
});

test("every committed Syria environment uses the Syria API only", async () => {
  for (const path of [".env", ".env.example", ".env.production"]) {
    const content = await read(path);
    assert.match(
      content,
      /^VITE_PUBLIC_DATA_API_BASE_URL=https:\/\/rawaj-classifieds-hub\.allidamech\.workers\.dev\/?$/m,
      `${path} must use the Syria Worker API`,
    );
  }
});

async function walk(relativeDirectory) {
  const files = await walkAll(relativeDirectory);
  return files.filter((path) => SCANNED_EXTENSIONS.has(extname(path)));
}

async function walkAll(relativeDirectory) {
  const absoluteDirectory = resolve(ROOT, relativeDirectory);
  let entries;
  try {
    entries = await readdir(absoluteDirectory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const output = [];
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
    if (entry.isDirectory()) output.push(...(await walkAll(path)));
    else output.push(path);
  }
  return output.sort();
}

async function pathExists(path) {
  try {
    await stat(resolve(ROOT, path));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function read(path) {
  return readFile(resolve(ROOT, path), "utf8");
}
