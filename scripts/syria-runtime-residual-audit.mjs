#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(new URL("..", import.meta.url).pathname);
const reportOnly = process.argv.includes("--report-only");
const roots = [
  "src",
  "cloudflare/worker/src",
  "cloudflare/worker/scripts",
  "public",
  ".github/workflows",
];
const files = [
  "package.json",
  "vite.config.ts",
  "vercel.json",
  "capacitor.config.ts",
  ".env.example",
  "cloudflare/worker/package.json",
  "cloudflare/worker/wrangler.base.jsonc",
];

const forbidden = [
  { label: "Saudi frontend origin", pattern: /(?:https:\/\/)?sa\.rawa-j\.com/gi },
  { label: "Saudi API/resource identity", pattern: /rawaj-saudi[\w.-]*/gi },
  { label: "Saudi environment binding", pattern: /\b(?:VITE_)?SAUDI_[A-Z0-9_]+\b/g },
  { label: "Saudi market text", pattern: /\bSaudi(?: Arabia|n)?\b|السعودية|سعودي(?:ة|ين)?/gi },
  { label: "Saudi public route", pattern: /\/saudi(?:\/|\b)/gi },
  { label: "Saudi currency", pattern: /\bSAR\b/g },
  { label: "Saudi phone prefix", pattern: /\+966\b/g },
  { label: "embedded gateway runtime", pattern: /rawaj-market-gateway/gi },
  { label: "embedded market server", pattern: /market-server/gi },
];

const ignoredPaths = new Set(["scripts/syria-runtime-residual-audit.mjs"]);
const auditedFiles = [...new Set([...roots.flatMap(collectTextFiles), ...files])]
  .filter((relative) => !ignoredPaths.has(relative) && fs.existsSync(path.join(repositoryRoot, relative)))
  .sort();
const violations = [];

for (const relative of auditedFiles) {
  const content = fs.readFileSync(path.join(repositoryRoot, relative), "utf8");
  for (const rule of forbidden) {
    rule.pattern.lastIndex = 0;
    for (const match of content.matchAll(rule.pattern)) {
      const line = content.slice(0, match.index).split("\n").length;
      violations.push(`${relative}:${line}: ${rule.label}: ${match[0]}`);
    }
  }
}

const report = {
  auditedFiles: auditedFiles.length,
  violations: violations.length,
  findings: violations,
};
console.log(JSON.stringify(report, null, 2));

if (!reportOnly) {
  assert.deepEqual(
    violations,
    [],
    `Standalone Syria active runtime contains Saudi/shared market bindings:\n${violations.join("\n")}`,
  );
}

function collectTextFiles(target) {
  const absolute = path.join(repositoryRoot, target);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [target];

  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", ".git", ".output", "dist", "build", "test-results"].includes(entry.name)) {
      return [];
    }
    const relative = path.join(target, entry.name);
    if (entry.isDirectory()) return collectTextFiles(relative);
    if (!entry.isFile()) return [];
    return /\.(?:ts|tsx|js|mjs|cjs|json|jsonc|css|html|txt|xml|java|kt|gradle|properties|ya?ml|toml)$/.test(
      entry.name,
    )
      ? [relative]
      : [];
  });
}
