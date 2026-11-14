#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const baseUrl = "https://rawaj-classifieds-hub.allidamech.workers.dev";
const canonicalOrigin = "https://rawa-j.com";
const canonicalWwwOrigin = "https://www.rawa-j.com";
const forbiddenOrigin = "https://sa.rawa-j.com";
const outputPath = resolve("public/audits/syria-cloudflare-public-live.json");
const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const probes = [];

await probe("health", "/v1/health", {
  origin: canonicalOrigin,
  summarize(payload) {
    const data = object(payload?.data);
    return {
      service: text(data.service),
      version: text(data.version),
      releaseSha: text(data.releaseSha),
      environment: text(data.environment),
      database: text(data.database),
      countryCode: text(data.countryCode),
    };
  },
  checks({ status, headers, summary }) {
    return {
      http200: status === 200,
      databaseReady: summary.database === "ready",
      SyrianServiceIdentity: summary.service === "rawaj-classifieds-hub",
      productionEnvironment: summary.environment === "production",
      releaseShaPresent: /^[0-9a-f]{40}$/.test(summary.releaseSha ?? ""),
      SyrianCountryIdentity: summary.countryCode === null || summary.countryCode === "SY",
      canonicalCors: headers.accessControlAllowOrigin === canonicalOrigin,
      credentialsNotEnabled: headers.accessControlAllowCredentials === null,
      requestIdValid: requestIdPattern.test(headers.requestId ?? ""),
      nosniff: headers.contentTypeOptions === "nosniff",
      noReferrer: headers.referrerPolicy === "no-referrer",
    };
  },
});

await probe("health-www", "/v1/health", {
  origin: canonicalWwwOrigin,
  summarize(payload) {
    return { service: text(object(payload?.data).service) };
  },
  checks({ status, headers }) {
    return {
      http200: status === 200,
      canonicalWwwCors: headers.accessControlAllowOrigin === canonicalWwwOrigin,
    };
  },
});

await probe("system-status", "/v1/system-status", {
  origin: canonicalOrigin,
  summarize(payload) {
    const data = object(payload?.data);
    return {
      maintenanceMode: booleanOrNull(data.maintenanceMode),
      emergencyReadOnly: booleanOrNull(data.emergencyReadOnly),
      freezeNewListings: booleanOrNull(data.freezeNewListings),
    };
  },
  checks({ status, summary }) {
    return {
      http200: status === 200,
      maintenanceDisabled: summary.maintenanceMode === false,
      emergencyReadOnlyDisabled: summary.emergencyReadOnly === false,
      listingFreezeDisabled:
        summary.freezeNewListings === null || summary.freezeNewListings === false,
    };
  },
});

await probe("public-listings", "/v1/listings?page=1&pageSize=1", {
  origin: canonicalWwwOrigin,
  summarize(payload) {
    const data = payload?.data;
    const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    return { returnedItems: rows.length };
  },
  checks({ status, headers }) {
    return {
      http200: status === 200,
      canonicalWwwCors: headers.accessControlAllowOrigin === canonicalWwwOrigin,
      cacheHeaderPresent: Boolean(headers.cacheControl),
    };
  },
});

await probe("public-references", "/v1/references", {
  origin: canonicalOrigin,
  summarize(payload) {
    const data = object(payload?.data);
    return {
      categories: length(data.categories),
      subcategories: length(data.subcategories),
      governorates: length(data.governorates),
      taxonomyNodes: length(data.taxonomyNodes),
    };
  },
  checks({ status, headers, summary }) {
    return {
      http200: status === 200,
      canonicalCors: headers.accessControlAllowOrigin === canonicalOrigin,
      categoriesAvailable: (summary.categories ?? 0) > 0,
      governoratesAvailable: (summary.governorates ?? 0) > 0,
    };
  },
});

await probe("profile-preflight", "/api/profile", {
  method: "OPTIONS",
  origin: canonicalOrigin,
  headers: {
    "Access-Control-Request-Method": "GET",
    "Access-Control-Request-Headers": "authorization,content-type,idempotency-key,if-none-match",
  },
  summarize() {
    return {};
  },
  checks({ status, headers }) {
    return {
      http204: status === 204,
      canonicalCors: headers.accessControlAllowOrigin === canonicalOrigin,
      credentialsNotEnabled: headers.accessControlAllowCredentials === null,
      authorizationAllowed: /authorization/i.test(headers.accessControlAllowHeaders ?? ""),
      idempotencyAllowed: /idempotency-key/i.test(headers.accessControlAllowHeaders ?? ""),
      ifNoneMatchAllowed: /if-none-match/i.test(headers.accessControlAllowHeaders ?? ""),
    };
  },
});

await probe("reject-saudi-origin", "/v1/health", {
  origin: forbiddenOrigin,
  summarize(payload) {
    return { service: text(object(payload?.data).service) };
  },
  checks({ status, headers }) {
    return {
      endpointReachable: status === 200,
      SaudiOriginNotAuthorized: headers.accessControlAllowOrigin === null,
    };
  },
});

await probe("reject-random-origin", "/v1/health", {
  origin: "https://example.invalid",
  summarize(payload) {
    return { service: text(object(payload?.data).service) };
  },
  checks({ status, headers }) {
    return {
      endpointReachable: status === 200,
      randomOriginNotAuthorized: headers.accessControlAllowOrigin === null,
    };
  },
});

const failedChecks = probes.flatMap((probeResult) =>
  Object.entries(probeResult.checks)
    .filter(([, passed]) => passed !== true)
    .map(([name]) => `${probeResult.name}.${name}`),
);
const report = {
  schemaVersion: 1,
  market: "SY",
  mode: "public-read-only",
  generatedAt: new Date().toISOString(),
  sourceCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null,
  target: {
    worker: "rawaj-classifieds-hub",
    baseUrl,
    canonicalOrigins: [canonicalOrigin, canonicalWwwOrigin],
  },
  overall: failedChecks.length === 0 ? "pass" : "issues-found",
  failedChecks,
  probes,
  limitations: [
    "No Cloudflare account token was used.",
    "Bindings, Worker secrets, deployment history, D1 schema metadata, R2 configuration, routes, analytics, and audit logs are not visible to this public probe.",
    "No write request, authenticated user request, D1 mutation, R2 object access, DNS change, or provider mutation was performed.",
  ],
};

await mkdir(resolve("public/audits"), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Syria public Cloudflare audit: ${report.overall}`);
for (const failed of failedChecks) console.log(`ISSUE: ${failed}`);

async function probe(name, pathname, options) {
  const url = new URL(pathname, `${baseUrl}/`);
  url.searchParams.set("audit_probe", `${Date.now()}-${crypto.randomUUID()}`);
  const requestHeaders = new Headers(options.headers ?? {});
  if (options.origin) requestHeaders.set("Origin", options.origin);

  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: requestHeaders,
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    const rawBody = await response.text();
    let payload = null;
    if (rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = null;
      }
    }
    const headers = safeHeaders(response.headers);
    const summary = options.summarize(payload, rawBody);
    const checks = options.checks({ status: response.status, headers, summary, payload });
    probes.push({
      name,
      method: options.method ?? "GET",
      path: pathname,
      status: response.status,
      durationMs: Date.now() - startedAt,
      headers,
      summary,
      checks,
    });
  } catch (error) {
    probes.push({
      name,
      method: options.method ?? "GET",
      path: pathname,
      status: null,
      durationMs: Date.now() - startedAt,
      headers: {},
      summary: {},
      checks: { requestCompleted: false },
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
  }
}

function safeHeaders(headers) {
  return {
    accessControlAllowOrigin: headers.get("access-control-allow-origin"),
    accessControlAllowCredentials: headers.get("access-control-allow-credentials"),
    accessControlAllowHeaders: headers.get("access-control-allow-headers"),
    accessControlAllowMethods: headers.get("access-control-allow-methods"),
    cacheControl: headers.get("cache-control"),
    contentType: headers.get("content-type"),
    contentTypeOptions: headers.get("x-content-type-options"),
    referrerPolicy: headers.get("referrer-policy"),
    requestId: headers.get("x-request-id"),
  };
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function text(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function booleanOrNull(value) {
  return typeof value === "boolean" ? value : null;
}
function length(value) {
  return Array.isArray(value) ? value.length : 0;
}
