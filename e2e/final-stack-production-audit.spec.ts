import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const auditOnly = process.env.FINAL_STACK_PRODUCTION_AUDIT !== "1";
const acceptanceEmail = process.env.RAWAJ_ACCEPTANCE_EMAIL ?? "";
const acceptancePassword = process.env.RAWAJ_ACCEPTANCE_PASSWORD ?? "";
const expectedFrontendCommit = process.env.EXPECTED_FRONTEND_COMMIT_SHA ?? "";
const expectedWorkerRelease = process.env.EXPECTED_WORKER_RELEASE_SHA ?? "";
const workerBase =
  process.env.RAWAJ_WORKER_BASE_URL ?? "https://rawaj-classifieds-hub.allidamech.workers.dev";

const publicRoutes = [
  "/",
  "/categories",
  "/listings",
  "/offers",
  "/support",
  "/safety",
  "/privacy",
  "/terms",
  "/prohibited",
  "/promotion",
  "/login",
] as const;

const authenticatedRoutes = [
  "/profile",
  "/profile/listings",
  "/add-listing",
  "/favorites",
  "/saved-searches",
  "/chats",
  "/notifications",
  "/activity",
  "/more",
  "/verification",
  "/promotion",
] as const;

const retiredVendor = ["supa", "base"].join("");
const retiredBackendPattern = new RegExp(`(?:^|[./_-])${retiredVendor}(?:[./_-]|$)`, "i");
const retiredBrowserStatePattern = new RegExp(`${retiredVendor}|^sb-`, "i");

function isKnownBenignFailure(url: string, failure: string): boolean {
  return (
    failure.includes("ERR_ABORTED") ||
    failure.includes("ERR_BLOCKED_BY_CLIENT") ||
    url.includes("va.vercel-scripts.com")
  );
}

function isKnownBenignConsoleError(text: string): boolean {
  return text.includes("va.vercel-scripts.com") || text.includes("ERR_BLOCKED_BY_CLIENT");
}

function observePage(page: Page) {
  const requestedUrls: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const workerServerErrors: string[] = [];
  const systemStatusResponses: number[] = [];

  page.on("request", (request) => requestedUrls.push(request.url()));
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !isKnownBenignConsoleError(message.text())) {
      consoleErrors.push(message.text());
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    if (!isKnownBenignFailure(request.url(), failure)) {
      failedRequests.push(`${request.method()} ${request.url()}: ${failure}`);
    }
  });
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/v1/system-status")) systemStatusResponses.push(response.status());
    if (url.startsWith(workerBase) && response.status() >= 500) {
      workerServerErrors.push(`${response.status()} ${response.request().method()} ${url}`);
    }
  });

  return {
    requestedUrls,
    pageErrors,
    consoleErrors,
    failedRequests,
    workerServerErrors,
    systemStatusResponses,
  };
}

function expectNoRetiredBackendTraffic(urls: string[]) {
  const retired = urls.filter((url) => retiredBackendPattern.test(url));
  expect(
    retired,
    `Production contacted the retired backend runtime:\n${retired.join("\n")}`,
  ).toEqual([]);
}

function expectCleanPageTelemetry(telemetry: ReturnType<typeof observePage>) {
  expectNoRetiredBackendTraffic(telemetry.requestedUrls);
  expect(telemetry.pageErrors).toEqual([]);
  expect(telemetry.consoleErrors).toEqual([]);
  expect(telemetry.failedRequests).toEqual([]);
  expect(telemetry.workerServerErrors).toEqual([]);
  expect(
    telemetry.systemStatusResponses.filter((status) => status !== 200),
    "Every observed /v1/system-status response must be HTTP 200",
  ).toEqual([]);
}

async function expectWorkerBoundary(request: APIRequestContext) {
  const headers = { Accept: "application/json", Origin: "https://rawa-j.com" };

  const health = await request.get(`${workerBase}/v1/health`, { headers });
  expect(health.status()).toBe(200);
  expect(health.headers()["access-control-allow-origin"]).toBe("https://rawa-j.com");
  const healthBody = (await health.json()) as {
    data?: { releaseSha?: string; environment?: string; database?: string };
  };
  expect(healthBody.data?.releaseSha).toBe(expectedWorkerRelease);
  expect(healthBody.data?.environment).toBe("production");
  expect(healthBody.data?.database).toBe("ready");

  const systemStatus = await request.get(`${workerBase}/v1/system-status`, { headers });
  expect(systemStatus.status()).toBe(200);
  expect(systemStatus.headers()["access-control-allow-origin"]).toBe("https://rawa-j.com");
  const systemBody = (await systemStatus.json()) as {
    data?: { maintenanceMode?: boolean; emergencyReadOnly?: boolean };
  };
  expect(systemBody.data?.maintenanceMode).toBe(false);
  expect(systemBody.data?.emergencyReadOnly).toBe(false);

  const protectedProfile = await request.get(`${workerBase}/api/profile`, { headers });
  expect(protectedProfile.status()).toBe(401);
}

async function expectHealthyRoute(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response, `Missing navigation response for ${path}`).not.toBeNull();
  expect(response!.status(), `${path} returned ${response!.status()}`).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await expect.poll(() => page.title()).not.toBe("");
}

test.describe("RAWAJ final Firebase + Cloudflare + retired-backend production audit", () => {
  test.skip(auditOnly, "Runs only from the dedicated final production audit workflow");

  test("public UX, media, Cloudflare health, CORS, and retired-backend isolation are clean", async ({
    page,
    request,
  }) => {
    expect(expectedFrontendCommit).not.toBe("");
    expect(expectedWorkerRelease).not.toBe("");
    const telemetry = observePage(page);

    await expectWorkerBoundary(request);

    for (const path of publicRoutes) await expectHealthyRoute(page, path);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    const deployedCommit = await page
      .locator('meta[name="rawaj-build-commit"]')
      .getAttribute("content");
    expect(deployedCommit).toBe(expectedFrontendCommit);

    const html = await page.content();
    expect(html).not.toMatch(retiredBackendPattern);

    const listingHref = await page.locator('a[href^="/listings/"]').first().getAttribute("href");
    expect(listingHref, "No real listing detail link was rendered on Production").toBeTruthy();
    await expectHealthyRoute(page, listingHref!);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    const imageSources = await page.locator("img[src]").evaluateAll((nodes) =>
      nodes
        .map((node) => (node as HTMLImageElement).currentSrc || (node as HTMLImageElement).src)
        .filter((src) => src.startsWith("http"))
        .slice(0, 8),
    );
    expect(
      imageSources.length,
      "Production rendered no externally loadable images",
    ).toBeGreaterThan(0);
    for (const src of imageSources) {
      expect(src).not.toMatch(retiredBackendPattern);
      const image = await request.get(src);
      expect(image.status(), `Image failed: ${src}`).toBeLessThan(400);
      expect(image.headers()["content-type"] ?? "").toMatch(/^image\//i);
    }

    await page.waitForTimeout(2_000);
    expectCleanPageTelemetry(telemetry);
  });

  test("Firebase login, Cloudflare profile bootstrap, session persistence, protected UX, and logout work", async ({
    page,
  }) => {
    expect(acceptanceEmail, "RAWAJ_ACCEPTANCE_EMAIL is missing").not.toBe("");
    expect(acceptancePassword, "RAWAJ_ACCEPTANCE_PASSWORD is missing").not.toBe("");
    const telemetry = observePage(page);

    const loginResponse = await page.goto("/login?returnTo=/profile", {
      waitUntil: "domcontentloaded",
    });
    expect(loginResponse?.status() ?? 200).toBeLessThan(500);

    const deployedCommit = await page
      .locator('meta[name="rawaj-build-commit"]')
      .getAttribute("content");
    expect(deployedCommit).toBe(expectedFrontendCommit);

    await page.locator('input[type="email"]').fill(acceptanceEmail);
    await page.locator('input[autocomplete="current-password"]').fill(acceptancePassword);
    await page.locator('form button[type="submit"]').click();
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
    await expect(page.locator("main")).toBeVisible();

    for (const path of authenticatedRoutes) {
      await expectHealthyRoute(page, path);
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
      await expect(page.getByText(/تسجيل الدخول مطلوب|Login required/)).toHaveCount(0);
    }

    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
    await expect(page.locator("main")).toBeVisible();

    const browserState = await page.evaluate(async () => {
      const localKeys = Object.keys(window.localStorage);
      const sessionKeys = Object.keys(window.sessionStorage);
      const databaseNames =
        typeof indexedDB.databases === "function"
          ? (await indexedDB.databases()).map((database) => database.name ?? "")
          : [];
      return { localKeys, sessionKeys, databaseNames };
    });
    const persistedNames = [
      ...browserState.localKeys,
      ...browserState.sessionKeys,
      ...browserState.databaseNames,
    ];
    expect(
      persistedNames.filter((name) => retiredBrowserStatePattern.test(name)),
      "Browser storage still contains retired-backend session state",
    ).toEqual([]);

    const cookies = await page.context().cookies();
    expect(
      cookies.map((cookie) => cookie.name).filter((name) => retiredBrowserStatePattern.test(name)),
      "Browser cookies still contain retired-backend session state",
    ).toEqual([]);

    expectNoRetiredBackendTraffic(telemetry.requestedUrls);
    expectCleanPageTelemetry(telemetry);

    const logoutButton = page
      .getByRole("button", { name: /تسجيل الخروج|Sign out|Log out/i })
      .first();
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();
    await expect(logoutButton).toHaveCount(0, { timeout: 30_000 });

    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expect(page.locator('a[href^="/login"]').first()).toBeVisible();
    expectCleanPageTelemetry(telemetry);
  });
});
