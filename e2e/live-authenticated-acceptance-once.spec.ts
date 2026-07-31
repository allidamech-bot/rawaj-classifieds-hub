import { expect, test, type Page, type Request } from "@playwright/test";

const email = process.env.RAWAJ_ACCEPTANCE_EMAIL ?? "";
const password = process.env.RAWAJ_ACCEPTANCE_PASSWORD ?? "";
const workerBaseUrl = "https://rawaj-classifieds-hub.allidamech.workers.dev";

const protectedRoutes = [
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
  "/admin",
  "/admin/pending",
] as const;

function requestLabel(request: Request) {
  return `${request.method()} ${request.url()}`;
}

function isIgnoredFailure(url: string, failure: string) {
  return (
    failure.includes("ERR_ABORTED") ||
    url.includes("va.vercel-scripts.com") ||
    url.includes("vercel.live")
  );
}

function isForbiddenMutation(request: Request) {
  const method = request.method();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return false;

  const url = new URL(request.url());
  if (!url.hostname.endsWith("workers.dev")) return false;

  return /^\/(?:api|v1)\/(?:listings|listing-images|admin|profile\/media|favorites|saved-searches|support|chats(?:\/|$))/.test(
    url.pathname,
  );
}

async function expectAuthenticatedPage(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response, `Missing navigation response for ${path}`).not.toBeNull();
  expect(response!.status(), `${path} returned ${response!.status()}`).toBeLessThan(500);
  await expect(page.locator("main"), `${path} did not render its main region`).toBeVisible();
  await expect(page, `${path} redirected to login`).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByText(/تسجيل الدخول مطلوب|Login required/)).toHaveCount(0);
}

async function submitHydratedLogin(page: Page) {
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[autocomplete="current-password"]');
  const submitButton = page.locator('form button[type="submit"]');

  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await expect(submitButton).toBeVisible();

  // The login form is server-rendered first. Wait for the client bundle before
  // filling it so React hydration cannot replace the typed values.
  await page.waitForLoadState("networkidle", { timeout: 20_000 });
  await page.waitForTimeout(300);

  await emailInput.fill(email);
  await passwordInput.fill(password);
  await expect(emailInput).toHaveValue(email);
  await expect(passwordInput).toHaveValue(password);
  await submitButton.click();
}

test.describe("RAWAJ live authenticated stack acceptance", () => {
  test("Firebase session, Cloudflare data paths, retired Supabase boundary, and logout", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    expect(email, "RAWAJ_ACCEPTANCE_EMAIL is missing").not.toBe("");
    expect(password, "RAWAJ_ACCEPTANCE_PASSWORD is missing").not.toBe("");

    const supabaseRequests: string[] = [];
    const forbiddenMutations: string[] = [];
    const failedRequests: string[] = [];
    const serverErrors: string[] = [];
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const firebaseRequests: string[] = [];
    const cloudflareRequests: string[] = [];
    const mediaResponses: string[] = [];

    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("request", (request) => {
      const label = requestLabel(request);
      const url = request.url().toLowerCase();

      if (url.includes("supabase.co") || url.includes("/supabase/")) supabaseRequests.push(label);
      if (url.includes("identitytoolkit.googleapis.com") || url.includes("securetoken.googleapis.com")) {
        firebaseRequests.push(label);
      }
      if (url.includes("workers.dev")) cloudflareRequests.push(label);
      if (isForbiddenMutation(request)) forbiddenMutations.push(label);
    });
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText ?? "unknown failure";
      if (!isIgnoredFailure(request.url(), failure)) {
        failedRequests.push(`${requestLabel(request)}: ${failure}`);
      }
    });
    page.on("response", (response) => {
      const url = response.url();
      if (response.status() >= 500 && (url.includes("rawa-j.com") || url.includes("workers.dev"))) {
        serverErrors.push(`${response.status()} ${url}`);
      }
      if (/workers\.dev\/v1\/(?:account\/)?media\/assets\//.test(url) && response.status() < 400) {
        mediaResponses.push(`${response.status()} ${url}`);
      }
    });

    const loginResponse = await page.goto("/login?returnTo=/profile", {
      waitUntil: "domcontentloaded",
    });
    expect(loginResponse?.status() ?? 200).toBeLessThan(500);

    const liveCommit = await page.locator('meta[name="rawaj-build-commit"]').getAttribute("content");
    expect(liveCommit, "Production build identity is missing").toMatch(/^[0-9a-f]{40}$/);
    expect((await page.content()).toLowerCase()).not.toContain("supabase.co");

    await submitHydratedLogin(page);

    await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
    await expect(page.locator("main")).toBeVisible();

    const health = await page.request.get(
      `${workerBaseUrl}/v1/health?acceptance_probe=${Date.now()}`,
      {
        headers: {
          Accept: "application/json",
          Origin: "https://rawa-j.com",
          "Cache-Control": "no-cache",
        },
      },
    );
    expect(health.status()).toBe(200);
    expect(health.headers()["access-control-allow-origin"]).toBe("https://rawa-j.com");
    const healthBody = await health.json();
    expect(healthBody?.data?.releaseSha).toMatch(/^[0-9a-f]{40}$/);
    expect(healthBody?.data?.environment).toBe("production");
    expect(healthBody?.data?.database).toBe("ready");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page, "Firebase session did not survive a full reload").not.toHaveURL(
      /\/login(?:\?|$)/,
    );
    await expect(page.locator("main")).toBeVisible();

    for (const path of protectedRoutes) {
      await expectAuthenticatedPage(page, path);
    }

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1_500);

    await page.goto("/more", { waitUntil: "domcontentloaded" });
    const logoutButton = page.getByRole("button", { name: /تسجيل الخروج|Log out/i });
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();
    await expect(logoutButton).toHaveCount(0, { timeout: 20_000 });

    // `/profile` intentionally remains a public guest surface after logout.
    // Verify the session is gone through the rendered guest identity instead
    // of requiring a redirect that the product does not implement.
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/زائر غير مسجّل|Guest.*not signed in/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /تسجيل الدخول|Log in/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /تسجيل الخروج|Log out/i })).toHaveCount(0);

    expect(firebaseRequests.length, "No Firebase authentication request was observed").toBeGreaterThan(0);
    expect(cloudflareRequests.length, "No Cloudflare Worker request was observed").toBeGreaterThan(0);
    expect(supabaseRequests, "Retired Supabase traffic was observed").toEqual([]);
    expect(forbiddenMutations, "Read-only acceptance triggered an application data mutation").toEqual([]);
    expect(serverErrors, "Production returned 5xx responses").toEqual([]);
    expect(failedRequests, "Unexpected network requests failed").toEqual([]);
    expect(pageErrors, "Unhandled browser errors occurred").toEqual([]);
    expect(consoleErrors, "Console errors occurred").toEqual([]);

    console.log(
      JSON.stringify({
        liveCommit,
        workerRelease: healthBody?.data?.releaseSha,
        firebaseRequestCount: firebaseRequests.length,
        cloudflareRequestCount: cloudflareRequests.length,
        mediaResponseCount: mediaResponses.length,
        testedProtectedRoutes: protectedRoutes.length,
        supabaseRequestCount: supabaseRequests.length,
        forbiddenMutationCount: forbiddenMutations.length,
        logoutVerified: true,
      }),
    );
  });
});
