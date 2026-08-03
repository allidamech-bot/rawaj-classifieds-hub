import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(new URL("..", import.meta.url).pathname);
const ignoredDirectories = new Set([".git", "node_modules", ".output", "dist", "build", "test-results"]);
const ignoredFiles = new Set(["scripts/syria-secret-hygiene.test.mjs", "package-lock.json"]);
const forbiddenPaths = [
  ".env",
  ".env.local",
  ".env.production",
  ".vercel/project.json",
  "firebase-service-account.json",
  "service-account.json",
  "android/app/google-services.json",
  "android/app/release.keystore",
  "android/app/release.jks",
];

const secretPatterns = [
  { label: "Firebase/Google API key", pattern: /AIza[0-9A-Za-z_-]{30,}/g },
  { label: "private key material", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { label: "service-account private key", pattern: /["']private_key["']\s*:/g },
  { label: "service-account client email", pattern: /["']client_email["']\s*:/g },
  { label: "Google service account", pattern: /["']type["']\s*:\s*["']service_account["']/g },
  {
    label: "literal Cloudflare token assignment",
    pattern: /CLOUDFLARE_API_TOKEN\s*=\s*(?!\$\{\{|\$|<|$)[^\s#]+/g,
  },
  {
    label: "literal Vercel token assignment",
    pattern: /VERCEL_TOKEN\s*=\s*(?!\$\{\{|\$|<|$)[^\s#]+/g,
  },
];

function collectFiles(directory, relative = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) return [];
    const absolute = path.join(directory, entry.name);
    const nextRelative = path.join(relative, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) return collectFiles(absolute, nextRelative);
    if (!entry.isFile() || ignoredFiles.has(nextRelative)) return [];
    return /\.(?:env|example|json|jsonc|ya?ml|toml|js|mjs|cjs|ts|tsx|java|kt|gradle|properties|md|sql|txt|xml)$/i.test(
      entry.name,
    )
      ? [nextRelative]
      : [];
  });
}

test("provider credentials and signing files are absent from the Syria repository", () => {
  for (const relative of forbiddenPaths) {
    assert.equal(fs.existsSync(path.join(repositoryRoot, relative)), false, relative);
  }
});

test("committed Syria text contains no recognizable provider secrets or private keys", () => {
  const violations = [];
  for (const relative of collectFiles(repositoryRoot)) {
    const content = fs.readFileSync(path.join(repositoryRoot, relative), "utf8");
    for (const rule of secretPatterns) {
      rule.pattern.lastIndex = 0;
      for (const match of content.matchAll(rule.pattern)) {
        const line = content.slice(0, match.index).split("\n").length;
        violations.push(`${relative}:${line}: ${rule.label}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Potential committed secrets detected:\n${violations.join("\n")}`,
  );
});
