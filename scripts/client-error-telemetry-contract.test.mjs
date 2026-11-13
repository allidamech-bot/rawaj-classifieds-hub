import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const [reporterSource, telemetryHandler, entry, security] = await Promise.all([
  readFile(new URL("../src/lib/lovable-error-reporting.ts", import.meta.url), "utf8"),
  readFile(new URL("../cloudflare/worker/src/client-error-telemetry.ts", import.meta.url), "utf8"),
  readFile(new URL("../cloudflare/worker/src/entry.ts", import.meta.url), "utf8"),
  readFile(new URL("../cloudflare/worker/src/security.ts", import.meta.url), "utf8"),
]);

function instantiateReporter(apiBase, captureException = undefined) {
  const javascript = ts.transpileModule(reporterSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const requests = [];
  const buildCommit = "a".repeat(40);
  const fakeWindow = {
    location: { pathname: "/listings/hidden-seller-id" },
    __lovableEvents: captureException ? { captureException } : undefined,
  };
  const fakeDocument = {
    querySelector: () => ({ getAttribute: () => buildCommit }),
  };
  const fakeFetch = (url, options) => {
    requests.push({ url, options });
    return Promise.resolve({ status: 202 });
  };
  // Exercise the actual browser reporter implementation with a stubbed
  // configured Cloudflare endpoint; no real network request is issued.
  const moduleFactory = new Function(
    "exports",
    "require",
    "window",
    "document",
    "fetch",
    javascript,
  );
  moduleFactory(
    exports,
    (specifier) => {
      assert.equal(specifier, "@/lib/public-data/config");
      return { publicDataRuntimeConfig: { cloudflareApiBaseUrl: apiBase } };
    },
    fakeWindow,
    fakeDocument,
    fakeFetch,
  );
  return { report: exports.reportLovableError, requests, fakeWindow };
}

test("browser errors reach configured Worker without secrets, stack traces, or identities", () => {
  const { report, requests } = instantiateReporter("https://api.rawa-j.com");
  const secret = "private-person@example.com Bearer verysecret123";
  report(new TypeError(`Cannot render ${secret}`), {
    boundary: "window_error",
    rawSecret: secret,
  });
  assert.equal(requests.length, 1);
  const { url, options } = requests[0];
  assert.equal(url, "https://api.rawa-j.com/v1/telemetry/client-errors");
  assert.equal(options.method, "POST");
  assert.equal(options.credentials, "omit");
  assert.equal(options.keepalive, true);
  assert.deepEqual(options.headers, { "Content-Type": "application/json" });
  assert.deepEqual(JSON.parse(options.body), {
    v: 1,
    mechanism: "manual",
    boundary: "window_error",
    severity: "error",
    routeGroup: "listings",
    buildCommit: "a".repeat(40),
    errorName: "TypeError",
  });
  assert.ok(!options.body.includes("private-person"));
  assert.ok(!options.body.includes("verysecret"));
  assert.ok(!options.body.includes("hidden-seller-id"));
});

test("missing Worker configuration disables telemetry without legacy fallback", () => {
  const { report, requests } = instantiateReporter(null);
  report(new Error("Never delivered"), { boundary: "window_error" });
  assert.equal(requests.length, 0);
});

test("external reporter exceptions cannot prevent independent Worker delivery", () => {
  const { report, requests } = instantiateReporter("https://api.rawa-j.com", () => {
    throw new Error("Third-party reporter failed");
  });
  assert.doesNotThrow(() => report(new Error("probe"), { boundary: "window_error" }));
  assert.equal(requests.length, 1);
});

test("browser reporter caps telemetry at three events per minute", () => {
  const { report, requests } = instantiateReporter("https://api.rawa-j.com");
  for (let index = 0; index < 10; index += 1) {
    report(new Error("test"), { boundary: "window_error" });
  }
  assert.equal(requests.length, 3);
});

test("the Worker endpoint routes through abuse limits and logs only fixed safe fields", () => {
  assert.match(entry, /pathname === "\/v1\/telemetry\/client-errors"/);
  assert.match(security, /path === "\/v1\/telemetry\/client-errors"/);
  assert.match(telemetryHandler, /MAX_BODY_BYTES = 1_024/);
  assert.match(telemetryHandler, /corsHeadersForOrigin/);
  assert.match(telemetryHandler, /event: "client_runtime_error"/);
  assert.doesNotMatch(
    telemetryHandler,
    /console\.error\([\s\S]*JSON\.stringify\(payload\)/,
  );
  assert.doesNotMatch(telemetryHandler, /request\.headers\.get\("Authorization"\)/);
});
