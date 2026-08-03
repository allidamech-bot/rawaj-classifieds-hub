import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const workflowsDirectory = path.join(root, ".github", "workflows");
const deploymentCommand =
  /\b(?:npx\s+)?(?:wrangler(?:@[^\s]+)?\s+deploy|vercel(?:\s+deploy|\s+--prod)|vercel\s+promote)\b/i;
const automaticTrigger =
  /(?:^|\n)\s{2}(?:push|schedule):|(?:^|\n)["']?on["']?:\s*\[[^\]]*\b(?:push|schedule)\b[^\]]*\]/im;

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

test("Vercel Git deployments remain disabled", () => {
  const config = readJson("vercel.json");
  assert.equal(
    config.git?.deploymentEnabled,
    false,
    "vercel.json must keep git.deploymentEnabled as the boolean false",
  );
});

test("no GitHub workflow can deploy from push or schedule", () => {
  const violations = [];

  for (const entry of fs.readdirSync(workflowsDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) continue;
    const filePath = path.join(workflowsDirectory, entry.name);
    const source = fs.readFileSync(filePath, "utf8");
    if (deploymentCommand.test(source) && automaticTrigger.test(source)) {
      violations.push(entry.name);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `automatic deployment workflows are forbidden: ${violations.join(", ")}`,
  );
});
