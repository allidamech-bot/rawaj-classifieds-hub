import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [router, monitoring, reporting, budget, qualityGate] = await Promise.all([
  readFile(new URL("../src/router.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/client-error-monitoring.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/lovable-error-reporting.ts", import.meta.url), "utf8"),
  readFile(new URL("./performance-budget.mjs", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("phase 54 enforces client chunk and stylesheet budgets after production build", () => {
  assert.match(budget, /minimumJavaScriptChunks/);
  assert.match(budget, /maximumSingleJavaScriptBytes/);
  assert.match(budget, /maximumTotalCssBytes/);
  assert.match(qualityGate, /Production build[\s\S]*Performance budget/);
});

test("phase 55 keeps performance budgets executable from package scripts", () => {
  assert.match(qualityGate, /npm run performance:budget/);
  assert.match(budget, /No client build output found/);
});

test("phase 56 captures global client failures without raw credentials in context", () => {
  assert.match(router, /installClientErrorMonitoring/);
  assert.match(monitoring, /unhandledrejection/);
  assert.match(monitoring, /window\.addEventListener\("error"/);
  assert.match(reporting, /\[redacted-email\]/);
  assert.match(reporting, /Bearer \[redacted\]/);
  assert.match(reporting, /rawaj-build-commit/);
});
