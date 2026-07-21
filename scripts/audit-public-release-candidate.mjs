#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import process from "node:process";
import { URL } from "node:url";

const baseUrl = normalizeBaseUrl(process.env.RAWAJ_RELEASE_BASE_URL);
const expectedCommit = normalizeExpectedCommit(
  process.env.RAWAJ_EXPECTED_COMMIT_SHA,
);
const allowAssetLinks503 = process.env.RAWAJ_ALLOW_ASSETLINKS_503 !== "0";
const outputPath =
  process.env.RAWAJ_RELEASE_AUDIT_OUTPUT?.trim() ||
  "rawaj-public-release-audit.json";
const timeoutMs = normalizeTimeout(
  process.env.RAWAJ_RELEASE_AUDIT_TIMEOUT_MS,
);

const htmlRoutes = [
  "/",
  "/categories",
  "/listings",
  "/offers",
  "/login",
  "/reset-password",
  "/support",
  "/safety",
  "/prohibited",
  "/privacy",
  "/terms",
];
const documentRoutes = [
  ...htmlRoutes.map((path) => ({ path, kind: "html" })),
  { path: "/robots.txt", kind: "text" },
  { path: "/sitemap.xml", kind: "xml" },
  { path: "/.well-known/assetlinks.json", kind: "assetlinks" },
];

const results = [];
const failures = [];

for (const route of documentRoutes) {
  const result = await auditRoute(route);
  results.push(result);
  failures.push(
    ...result.failures.map((message) => `${route.path}: ${message}`),
  );
}

const report = {
  schemaVersion: 1,
  auditedAt: new Date().toISOString(),
  baseUrl: baseUrl.origin,
  expectedCommit: expectedCommit || null,
  allowAssetLinks503,
  timeoutMs,
  passed: failures.length === 0,
  failureCount: failures.length,
  failures,
  routes: results,
};

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
globalThis.console.log(JSON.stringify(report, null, 2));

if (!report.passed) process.exitCode = 1;

async function auditRoute(route) {
  const url = new URL(route.path, baseUrl);
  const startedAt = Date.now();
  const failures = [];
  let response;
  let body = "";

  try {
    response = await globalThis.fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        accept: acceptHeader(route.kind),
        "user-agent": "rawaj-public-release-audit/1.0",
      },
      signal: globalThis.AbortSignal.timeout(timeoutMs),
    });
    body = await response.text();
  } catch (error) {
    return {
      path: route.path,
      kind: route.kind,
      url: url.href,
      status: null,
      durationMs: Date.now() - startedAt,
      contentType: null,
      buildCommit: null,
      failures: [`request failed: ${formatError(error)}`],
    };
  }

  const contentType = response.headers.get("content-type") ?? "";
  const headerCommit =
    response.headers.get("x-rawaj-build-commit")?.trim() || null;
  const metaCommit =
    route.kind === "html" ? extractBuildCommitMeta(body) : null;
  const buildCommit = headerCommit || metaCommit;

  if (isRedirect(response.status)) {
    failures.push(`unexpected redirect status ${response.status}`);
  }

  if (route.kind === "assetlinks") {
    validateAssetLinks(response, body, contentType, failures);
  } else {
    if (response.status !== 200) {
      failures.push(`expected HTTP 200, received ${response.status}`);
    }
    validateContentType(route.kind, contentType, failures);
  }

  if (route.kind === "html") {
    validateHtmlDocument(response, body, failures);
    if (expectedCommit && buildCommit !== expectedCommit) {
      failures.push(
        `build commit mismatch: expected ${expectedCommit}, received ${buildCommit ?? "missing"}`,
      );
    }
  }

  if (route.path === "/login" || route.path === "/reset-password") {
    const cacheControl =
      response.headers.get("cache-control")?.toLowerCase() ?? "";
    if (!cacheControl.includes("no-store")) {
      failures.push("sensitive auth route must use cache-control: no-store");
    }
  }

  return {
    path: route.path,
    kind: route.kind,
    url: url.href,
    status: response.status,
    durationMs: Date.now() - startedAt,
    contentType: contentType || null,
    buildCommit,
    cacheControl: response.headers.get("cache-control"),
    failures,
  };
}

function validateHtmlDocument(response, body, failures) {
  if (!body.toLowerCase().includes("<!doctype html")) {
    failures.push("response is not an HTML document");
  }
  if (!body.includes("rawaj-build-commit")) {
    failures.push("missing rawaj build metadata");
  }

  for (const [header, expected] of [
    ["x-content-type-options", "nosniff"],
    ["x-frame-options", "DENY"],
  ]) {
    if (response.headers.get(header) !== expected) {
      failures.push(`missing or invalid ${header}`);
    }
  }
  if (!response.headers.get("content-security-policy")) {
    failures.push("missing content-security-policy");
  }
  if (!response.headers.get("referrer-policy")) {
    failures.push("missing referrer-policy");
  }
}

function validateAssetLinks(response, body, contentType, failures) {
  if (isRedirect(response.status)) return;
  if (!contentType.toLowerCase().includes("application/json")) {
    failures.push(
      `expected JSON content type, received ${contentType || "missing"}`,
    );
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    failures.push("response body is not valid JSON");
    return;
  }

  if (response.status === 503 && allowAssetLinks503) {
    if (payload?.error !== "android_app_links_not_configured") {
      failures.push(
        "503 response must fail closed with android_app_links_not_configured",
      );
    }
    return;
  }

  if (response.status !== 200) {
    failures.push(
      `expected HTTP 200${allowAssetLinks503 ? " or fail-closed 503" : ""}, received ${response.status}`,
    );
    return;
  }

  if (!Array.isArray(payload) || payload.length === 0) {
    failures.push("assetlinks payload must be a non-empty array");
    return;
  }

  const statement = payload.find(
    (entry) => entry?.target?.package_name === "com.rawaj.marketplace",
  );
  if (!statement) {
    failures.push("assetlinks payload is missing com.rawaj.marketplace");
    return;
  }
  if (
    !statement.relation?.includes(
      "delegate_permission/common.handle_all_urls",
    )
  ) {
    failures.push("assetlinks relation is missing handle_all_urls");
  }
  const fingerprints = statement.target?.sha256_cert_fingerprints;
  if (!Array.isArray(fingerprints) || fingerprints.length === 0) {
    failures.push("assetlinks payload has no SHA-256 fingerprints");
  } else if (
    fingerprints.some(
      (value) => !/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value),
    )
  ) {
    failures.push("assetlinks payload contains an invalid SHA-256 fingerprint");
  }
}

function validateContentType(kind, contentType, failures) {
  const normalized = contentType.toLowerCase();
  const valid =
    (kind === "html" && normalized.includes("text/html")) ||
    (kind === "text" && normalized.includes("text/plain")) ||
    (kind === "xml" &&
      (normalized.includes("application/xml") ||
        normalized.includes("text/xml")));
  if (!valid) {
    failures.push(`unexpected content type ${contentType || "missing"}`);
  }
}

function normalizeBaseUrl(value) {
  if (!value?.trim()) {
    throw new Error("RAWAJ_RELEASE_BASE_URL is required");
  }
  const url = new URL(value.trim());
  if (url.protocol !== "https:") {
    throw new Error("Release audit requires HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("Credentials are not allowed in the audit URL");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("RAWAJ_RELEASE_BASE_URL must contain only the origin");
  }
  if (!isAllowedHost(url.hostname)) {
    throw new Error(
      `Host is not approved for RAWAJ release audit: ${url.hostname}`,
    );
  }
  return url;
}

function isAllowedHost(hostname) {
  return (
    hostname === "rawa-j.com" ||
    hostname === "www.rawa-j.com" ||
    hostname.endsWith(".vercel.app")
  );
}

function normalizeExpectedCommit(value) {
  const commit = value?.trim() || "";
  if (!commit) return "";
  if (!/^[0-9a-f]{7,40}$/i.test(commit)) {
    throw new Error("RAWAJ_EXPECTED_COMMIT_SHA must be a Git commit SHA");
  }
  return commit.toLowerCase();
}

function normalizeTimeout(value) {
  const parsed = Number(value || 20_000);
  if (!Number.isFinite(parsed) || parsed < 1_000 || parsed > 60_000) {
    throw new Error(
      "RAWAJ_RELEASE_AUDIT_TIMEOUT_MS must be between 1000 and 60000",
    );
  }
  return parsed;
}

function extractBuildCommitMeta(body) {
  return (
    body.match(
      /<meta\s+name=["']rawaj-build-commit["']\s+content=["']([0-9a-f]{7,40})["']/i,
    )?.[1]?.toLowerCase() ?? null
  );
}

function acceptHeader(kind) {
  if (kind === "assetlinks") return "application/json";
  if (kind === "xml") {
    return "application/xml,text/xml;q=0.9,*/*;q=0.1";
  }
  if (kind === "text") return "text/plain,*/*;q=0.1";
  return "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1";
}

function isRedirect(status) {
  return status >= 300 && status < 400;
}

function formatError(error) {
  if (!(error instanceof Error)) return String(error);
  const cause =
    error.cause instanceof Error ? `; cause: ${error.cause.message}` : "";
  return `${error.message}${cause}`;
}
