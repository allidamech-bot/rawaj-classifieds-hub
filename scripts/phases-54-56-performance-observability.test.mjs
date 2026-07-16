import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [router, monitoring, reporting, budget, server, qualityGate] = await Promise.all([
  readFile(new URL("../src/router.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/client-error-monitoring.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/lovable-error-reporting.ts", import.meta.url), "utf8"),
  readFile(new URL("./performance-budget.mjs", import.meta.url), "utf8"),
  readFile(new URL("../src/server.ts", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("phase 54 enforces production JavaScript, stylesheet, font and image budgets", () => {
  assert.match(budget, /minimumJavaScriptChunks/);
  assert.match(budget, /maximumJavaScriptChunks/);
  assert.match(budget, /maximumSingleJavaScriptBytes/);
  assert.match(budget, /maximumTotalCssBytes/);
  assert.match(budget, /maximumSingleFontBytes/);
  assert.match(budget, /maximumSingleImageBytes/);
  assert.match(budget, /performance-budget-report\.json/);
  assert.match(budget, /RAWAJ_PERFORMANCE_REPORT=/);
  assert.match(qualityGate, /Production build[\s\S]*Performance budget/);
});

test("phase 55 keeps performance budgets executable after the production build", () => {
  assert.match(qualityGate, /npm run performance:budget/);
  assert.match(budget, /No client build output found/);
  assert.match(budget, /largestAssets/);
  assert.match(budget, /summarizeLargest/);
});

test("phase 56 captures global client and hydration failures without raw page content", () => {
  assert.match(router, /installClientErrorMonitoring/);
  assert.match(monitoring, /unhandledrejection/);
  assert.match(monitoring, /window\.addEventListener\("error"/);
  assert.match(monitoring, /React hydration mismatch detected/);
  assert.match(monitoring, /boundary: "react_hydration_warning"/);
  assert.doesNotMatch(monitoring, /reportLovableError\([\s\S]*args,/);
  assert.match(reporting, /\[redacted-email\]/);
  assert.match(reporting, /Bearer \[redacted\]/);
  assert.match(reporting, /rawaj-build-commit/);
});

test("SSR observability records build identity, duration and pathname only", () => {
  assert.match(server, /server-timing/);
  assert.match(server, /x-rawaj-build-commit/);
  assert.match(server, /slow_public_render/);
  assert.match(server, /ssr_request_failed/);
  assert.match(server, /pathname: url\.pathname/);
  assert.match(server, /\[redacted-jwt\]/);
  assert.doesNotMatch(server, /searchParams|request\.headers|get\("authorization"\)|request\.text\(/);
});
