const baseUrl = (
  process.env.RAWAJ_WORKER_BASE_URL || "https://rawaj-classifieds-hub.allidamech.workers.dev"
).replace(/\/$/, "");
const origin = "https://rawa-j.com";

const checks = [
  {
    name: "ad placements",
    path: "/v1/ad-placements?page=home&device=mobile",
    allowedStatuses: new Set([200]),
  },
  {
    name: "profile authentication boundary",
    path: "/api/profile",
    allowedStatuses: new Set([401]),
  },
];

let failed = false;

for (const check of checks) {
  try {
    const response = await fetch(`${baseUrl}${check.path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Origin: origin,
      },
      redirect: "manual",
    });

    const allowOrigin = response.headers.get("access-control-allow-origin");
    const requestId = response.headers.get("x-request-id");
    const body = await response.text();

    const corsOk = allowOrigin === origin;
    const statusOk = check.allowedStatuses.has(response.status);

    if (!corsOk || !statusOk) {
      failed = true;
      console.error(
        JSON.stringify({
          check: check.name,
          ok: false,
          status: response.status,
          expectedStatuses: [...check.allowedStatuses],
          allowOrigin,
          requestId,
          body: body.slice(0, 500),
        }),
      );
      continue;
    }

    console.log(
      JSON.stringify({
        check: check.name,
        ok: true,
        status: response.status,
        allowOrigin,
        requestId,
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
  console.error("Remote Worker smoke checks failed.");
  process.exitCode = 1;
} else {
  console.log("Remote Worker smoke checks passed.");
}
