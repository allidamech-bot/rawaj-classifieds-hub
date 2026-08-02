import fs from "node:fs";

const entryPath = "cloudflare/worker/src/entry.ts";
let entry = fs.readFileSync(entryPath, "utf8");
const oldRoute = `    /^\\/v1\\/admin\\/(?:listing-reports|seller-reviews|seller-review-reports)(?:\\/|$)/.test(path)`;
const newRoute = `    /^\\/v1\\/admin\\/(?:support-requests|listing-reports|seller-reviews|seller-review-reports)(?:\\/|$)/.test(path)`;
if (!entry.includes(oldRoute)) throw new Error("Trust-support router anchor is missing");
if (entry.indexOf(oldRoute) !== entry.lastIndexOf(oldRoute)) {
  throw new Error("Trust-support router anchor is not unique");
}
entry = entry.replace(oldRoute, newRoute);
fs.writeFileSync(entryPath, entry);

const testPath = "cloudflare/worker/test/support-admin.test.mjs";
let testSource = fs.readFileSync(testPath, "utf8");
if (!testSource.includes('const source = fs.readFileSync(new URL("../src/trust-support.ts", import.meta.url), "utf8");')) {
  throw new Error("Support admin test anchor is missing");
}
testSource = testSource.replace(
  'const source = fs.readFileSync(new URL("../src/trust-support.ts", import.meta.url), "utf8");',
  'const source = fs.readFileSync(new URL("../src/trust-support.ts", import.meta.url), "utf8");\nconst entrySource = fs.readFileSync(new URL("../src/entry.ts", import.meta.url), "utf8");',
);
testSource += `\n\ntest("entry router delegates admin support requests to trust support", () => {\n  const start = entrySource.indexOf("function isTrustSupportPath(");\n  const end = entrySource.indexOf("function isAccountSocialPath(", start);\n  assert.ok(start >= 0 && end > start);\n  assert.match(entrySource.slice(start, end), /support-requests/);\n});\n`;
fs.writeFileSync(testPath, testSource);

for (const path of [
  "scripts/apply-saudi-support-router-fix.mjs",
  ".github/workflows/apply-saudi-support-router-fix.yml",
]) {
  if (fs.existsSync(path)) fs.unlinkSync(path);
}
