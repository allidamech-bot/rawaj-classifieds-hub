const baseUrl = (
  process.env.RAWAJ_WORKER_BASE_URL || "https://rawaj-classifieds-hub.allidamech.workers.dev"
).replace(/\/$/, "");
const expectedReleaseSha = process.env.RAWAJ_WORKER_EXPECTED_RELEASE_SHA?.trim() ?? "";
const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!/^[0-9a-f]{40}$/.test(expectedReleaseSha)) {
  console.error("RAWAJ_WORKER_EXPECTED_RELEASE_SHA must be an exact 40-character Git SHA.");
  process.exit(1);
}

const checks = [
  {
    name: "health CORS for canonical origin",
    method: "GET",
    path: "/v1/health",
    origin: "https://rawa-j.com",
    expectedStatus: 200,
    verifyRelease: true,
  },
  {
    name: "health CORS for www origin",
    method: "GET",
    path: "/v1/health",
    origin: "https://www.rawa-j.com",
    expectedStatus: 200,
    verifyRelease: true,
  },
  {
    name: "public references",
    method: "GET",
    path: "/v1/references",
    origin: "https://rawa-j.com",
    expectedStatus: 200,
  },
  {
    name: "public listings",
    method: "GET",
    path: "/v1/listings",
    origin: "https://www.rawa-j.com",
    expectedStatus: 200,
  },
  {
    name: "public ad placements",
    method: "GET",
    path: "/v1/ad-placements?page=home&device=desktop",
    origin: "https://rawa-j.com",
    expectedStatus: 200,
  },
  {
    name: "profile preflight",
    method: "OPTIONS",
    path: "/api/profile",
    origin: "https://www.rawa-j.com",
    expectedStatus: 204,
    headers: {
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  },
];

let failed = false;

for (const check of checks) {
  try {
    const response = await fetch(`${baseUrl}${check.path}`, {
      method: check.method,
      headers: {
        Accept: "application/json",
        Origin: check.origin,
        ...check.headers,
      },
      redirect: "manual",
    });
    const allowOrigin = response.headers.get("access-control-allow-origin");
    const allowCredentials = response.headers.get("access-control-allow-credentials");
    const requestId = response.headers.get("x-request-id");
    const contentTypeOptions = response.headers.get("x-content-type-options");
    const referrerPolicy = response.headers.get("referrer-policy");
    const body = response.status === 204 ? "" : await response.text();
    const corsOk = allowOrigin === check.origin && allowCredentials === null;
    const statusOk = response.status === check.expectedStatus;
    const requestIdOk = Boolean(requestId && requestIdPattern.test(requestId));
    const securityHeadersOk = contentTypeOptions === "nosniff" && referrerPolicy === "no-referrer";
    let releaseOk = true;
    let actualReleaseSha = null;

    if (check.verifyRelease) {
      try {
        const parsed = JSON.parse(body);
        actualReleaseSha = parsed?.data?.releaseSha ?? null;
        releaseOk =
          actualReleaseSha === expectedReleaseSha && parsed?.data?.environment === "production";
      } catch {
        releaseOk = false;
      }
    }

    if (!corsOk || !statusOk || !releaseOk || !requestIdOk || !securityHeadersOk) {
      failed = true;
      console.error(
        JSON.stringify({
          check: check.name,
          ok: false,
          status: response.status,
          expectedStatus: check.expectedStatus,
          origin: check.origin,
          allowOrigin,
          allowCredentials,
          credentialFreeCors: allowCredentials === null,
          requestId,
          requestIdValid: requestIdOk,
          contentTypeOptions,
          referrerPolicy,
          securityHeadersValid: securityHeadersOk,
          releaseMatches: releaseOk,
          actualReleaseSha,
        }),
      );
      continue;
    }

    console.log(
      JSON.stringify({
        check: check.name,
        ok: true,
        status: response.status,
        origin: check.origin,
        allowOrigin,
        credentialFreeCors: true,
        requestId,
        securityHeadersValid: securityHeadersOk,
        ...(check.verifyRelease ? { releaseSha: actualReleaseSha } : {}),
      }),
    );
  } catch (error) {
    failed = true;
    console.error(
      JSON.stringify({
        check: check.name,
        ok: false,
        networkError: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

if (failed) {
  console.error("Remote Worker verification failed. No second deployment will be attempted.");
  console.error(
    "Review the failed check. If rollback is approved, use Cloudflare deployment history to select the previously verified Worker version; this script never performs rollback.",
  );
  process.exitCode = 1;
} else {
  console.log("Remote Worker read-only verification passed.");
}
