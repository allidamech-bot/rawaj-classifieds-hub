import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import "./authenticated-e2e-isolation.test.mjs";
import "./cloudflare-worker-package-isolation.test.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const RUNTIME_ROOTS = ["src", "cloudflare/worker/src"];
const MANIFESTS = [
  "package.json",
  "package-lock.json",
  "cloudflare/worker/package.json",
  "cloudflare/worker/package-lock.json",
];
const REQUIRED_ENV_FILES = [".env", ".env.example", ".env.production"];

const retiredBackendPatterns = [
  ["retired SDK", /@supabase\/supabase-js/i],
  ["retired service host", /https?:\/\/[^\s"']*supabase\.(?:co|com)/i],
  ["retired environment variable", /\b(?:VITE_)?SUPABASE_[A-Z0-9_]+\b/],
  ["retired runtime module", /(?:@\/lib\/supabase|(?:^|["'])\.?.*\/supabase(?:["']|$))/im],
];

const forbiddenFirebaseDataPatterns = [
  ["Firestore runtime", /from\s+["']firebase\/firestore["']/],
  ["Firebase Storage runtime", /from\s+["']firebase\/storage["']/],
  ["Realtime Database runtime", /from\s+["']firebase\/database["']/],
  ["Cloud Functions runtime", /from\s+["']firebase\/functions["']/],
  ["Firestore constructor", /\bgetFirestore\s*\(/],
  ["Firebase Storage constructor", /\bgetStorage\s*\(/],
  ["Realtime Database constructor", /\bgetDatabase\s*\(/],
  ["Callable Functions constructor", /\bhttpsCallable\s*\(/],
  ["Firebase Storage bucket configuration", /\bstorageBucket\s*:/],
  ["Firebase Storage service host", /https?:\/\/[^\s"']*firebasestorage\.app/i],
];

const runtimeFiles = (
  await Promise.all(RUNTIME_ROOTS.map((root) => walk(root, SOURCE_EXTENSIONS)))
).flat();

const trackedEnvironmentFiles = (await walk(".", new Set())).filter(isEnvironmentFile);
const configurationFiles = [
  ...MANIFESTS,
  ...trackedEnvironmentFiles,
  "vercel.json",
  "vite.config.ts",
  "capacitor.config.ts",
].filter((path, index, items) => items.indexOf(path) === index);

test("Supabase cannot return to manifests, configuration, or runtime code", async () => {
  for (const path of [...configurationFiles, ...runtimeFiles]) {
    const content = await read(path);
    for (const [label, pattern] of retiredBackendPatterns) {
      assert.doesNotMatch(content, pattern, `${path} contains ${label}`);
    }
  }
});

test("Firebase remains authentication-only while Cloudflare owns application data and media", async () => {
  for (const path of runtimeFiles) {
    const content = await read(path);
    for (const [label, pattern] of forbiddenFirebaseDataPatterns) {
      assert.doesNotMatch(content, pattern, `${path} contains forbidden ${label}`);
    }
  }
});

test("all committed application environments select the Cloudflare provider", async () => {
  for (const path of REQUIRED_ENV_FILES) {
    const content = await read(path);
    assert.match(content, /^VITE_PUBLIC_DATA_PROVIDER=cloudflare$/m, `${path} must select Cloudflare`);
    assert.match(
      content,
      /^VITE_PUBLIC_DATA_API_BASE_URL=https:\/\/(?:api\.rawa-j\.com|rawaj-classifieds-hub\.allidamech\.workers\.dev)\/?$/m,
      `${path} must use an approved Cloudflare API origin`,
    );
  }
});

test("the retired SDK is absent from both dependency manifests", async () => {
  for (const path of ["package.json", "cloudflare/worker/package.json"]) {
    const manifest = JSON.parse(await read(path));
    const packages = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) };
    assert.equal(packages["@supabase/supabase-js"], undefined, `${path} contains the retired SDK`);
  }
});

test("Cloudflare CORS stays credential-free and its Production smoke enforces the boundary", async () => {
  const cors = await read("cloudflare/worker/src/cors.ts");
  const smoke = await read("cloudflare/worker/scripts/remote-smoke.mjs");
  assert.doesNotMatch(cors, /Access-Control-Allow-Credentials/i);
  assert.match(smoke, /access-control-allow-credentials/);
  assert.match(smoke, /allowCredentials === null/);
  assert.match(smoke, /credentialFreeCors/);
});

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
    if (entry.isDirectory()) {
      output.push(...(await walk(path, extensions)));
    } else if (extensions.has(extname(entry.name)) || isEnvironmentFile(path)) {
      output.push(path);
    }
  }
  return output;
}

function isEnvironmentFile(path) {
  const name = path.split("/").at(-1) ?? path;
  return /^\.env(?:\..+)?$/.test(name) || /^\.dev\.vars(?:\..+)?$/.test(name);
}

function read(path) {
  return readFile(resolve(ROOT, path), "utf8");
}
