const baseUrl = (
  process.env.RAWAJ_WORKER_BASE_URL || "https://rawaj-classifieds-hub.allidamech.workers.dev"
).replace(/\/$/, "");
const expectedReleaseSha = process.env.RAWAJ_WORKER_EXPECTED_RELEASE_SHA?.trim() ?? "";
const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RELEASE_VERIFY_ATTEMPTS = 18;
const RELEASE_VERIFY_DELAY_MS = 5_000;

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

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function requestUrl(check, attempt) {
  const url = new URL(check.path, `${baseUrl}/`);
  if (check.verifyRelease) {
    url.searchParams.set(
      "release_probe",
      `${expectedReleaseSha}-${attempt}-${Date.now()}-${crypto.randomUUID()}`,
    );
  }
  return url;
}

function inspectResponse(check, response, body) {
  const allowOrigin = response.headers.get("access-control-allow-origin");
  const allowCredentials = response.headers.get("access-control-allow-credentials");
  const requestId = response.headers.get("x-request-id");
  const contentTypeOptions = response.headers.get("x-content-type-options");
  const referrerPolicy = response.headers.get("referrer-policy");
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

  return {
    ok: corsOk && statusOk && releaseOk && requestIdOk && securityHeadersOk,
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
  };
}

async function runCheck(check) {
  const attempts = check.verifyRelease ? RELEASE_VERIFY_ATTEMPTS : 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(requestUrl(check, attempt), {
        method: check.method,
        headers: {
          Accept: "application/json",
          Origin: check.origin,
          ...(check.verifyRelease ? { "Cache-Control": "no-cache" } : {}),
          ...check.headers,
        },
        redirect: "manual",
      });
      const body = response.status === 204 ? "" : await response.text();
      const result = inspectResponse(check, response, body);

      if (result.ok) {
        console.log(
          JSON.stringify({
            check: check.name,
            ok: true,
            status: result.status,
            origin: result.origin,
            allowOrigin: result.allowOrigin,
            credentialFreeCors: true,
            requestId: result.requestId,
            securityHeadersValid: result.securityHeadersValid,
            ...(check.verifyRelease ? { releaseSha: result.actualReleaseSha, attempt } : {}),
          }),
        );
        return true;
      }

      if (check.verifyRelease && attempt < attempts) {
        console.warn(
          JSON.stringify({
            check: check.name,
            ok: false,
            retrying: true,
            attempt,
            attempts,
            actualReleaseSha: result.actualReleaseSha,
            expectedReleaseSha,
          }),
        );
        await sleep(RELEASE_VERIFY_DELAY_MS);
        continue;
      }

      console.error(JSON.stringify({ check: check.name, ok: false, ...result }));
      return false;
    } catch (error) {
      if (check.verifyRelease && attempt < attempts) {
        console.warn(
          JSON.stringify({
            check: check.name,
            ok: false,
            retrying: true,
            attempt,
            attempts,
            networkError: error instanceof Error ? error.message : String(error),
          }),
        );
        await sleep(RELEASE_VERIFY_DELAY_MS);
        continue;
      }

      console.error(
        JSON.stringify({
          check: check.name,
          ok: false,
          networkError: error instanceof Error ? error.message : String(error),
        }),
      );
      return false;
    }
  }

  return false;
}

let failed = false;
for (const check of checks) {
  if (!(await runCheck(check))) failed = true;
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
