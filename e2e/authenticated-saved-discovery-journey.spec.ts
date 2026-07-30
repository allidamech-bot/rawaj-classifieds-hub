import { expect, test, type Locator, type Page } from "@playwright/test";

const FIXTURE_TOKEN = "rawaj-e2e-firebase-token";
const LISTING_ID = "e2e-listing-featured";
const LISTING_TITLE = "سيارة عائلية بحالة ممتازة";
const SAVED_SEARCH_NAME = "سيارات دمشق المفضلة";
const SAVED_SEARCH_ID = "00000000-0000-4000-8000-000000000061";

test.describe("authenticated launch-critical saved discovery journey", () => {
  test.setTimeout(120_000);

  test("favorites and saved searches persist without duplicate writes", async ({ page }) => {
    const remoteWrites: string[] = [];
    const authorizedRequests: string[] = [];
    let favoriteCreates = 0;
    let favoriteDeletes = 0;
    let savedSearchCreates = 0;
    let savedSearchUpdates = 0;
    let savedSearchDeletes = 0;

    const resetResponse = await page.request.post("/__rawaj_e2e__/saved-discovery/reset", {
      headers: { "x-rawaj-e2e-reset": "1" },
    });
    expect(resetResponse.ok()).toBe(true);

    page.on("request", (request) => {
      const url = new URL(request.url());
      const method = request.method();
      const isLocal = ["127.0.0.1", "localhost"].includes(url.hostname);
      if (!isLocal && method !== "GET" && method !== "HEAD") {
        remoteWrites.push(`${method} ${request.url()}`);
      }

      const privateRequest =
        url.pathname === "/api/profile" ||
        url.pathname === "/v1/account/favorites" ||
        url.pathname.startsWith("/v1/account/saved-searches") ||
        url.pathname === `/v1/listings/${LISTING_ID}/favorite`;
      if (privateRequest) {
        expect(request.headers().authorization).toBe(`Bearer ${FIXTURE_TOKEN}`);
        authorizedRequests.push(`${method} ${url.pathname}`);
      }

      if (url.pathname === `/v1/listings/${LISTING_ID}/favorite`) {
        if (method === "POST") favoriteCreates += 1;
        if (method === "DELETE") favoriteDeletes += 1;
      }
      if (url.pathname === "/v1/account/saved-searches" && method === "POST") {
        savedSearchCreates += 1;
      }
      if (url.pathname === `/v1/account/saved-searches/${SAVED_SEARCH_ID}`) {
        if (method === "PATCH") savedSearchUpdates += 1;
        if (method === "DELETE") savedSearchDeletes += 1;
      }
    });

    await page.addInitScript(() => {
      const marker = "rawaj:e2e:saved-discovery-storage-cleared";
      if (window.sessionStorage.getItem(marker) === "1") return;
      window.localStorage.clear();
      window.sessionStorage.setItem(marker, "1");
    });

    await signIn(page, `/listings/${LISTING_ID}`);
    await expect(page).toHaveURL(new RegExp(`/listings/${LISTING_ID}(?:[/?#]|$)`), {
      timeout: 30_000,
    });

    const saveFavoriteButton = page.getByRole("button", {
      name: /حفظ في المفضلة|Save to favorites/i,
    });
    await expect(saveFavoriteButton).toHaveAttribute("aria-pressed", "false", {
      timeout: 30_000,
    });
    await clickTwiceInSameTick(saveFavoriteButton);
    await expect(
      page.getByRole("button", { name: /إزالة من المفضلة|Remove from favorites/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(favoriteCreates).toBe(1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    await expect(
      page.getByRole("button", { name: /إزالة من المفضلة|Remove from favorites/i }),
    ).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });

    await page.goto("/favorites", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    const favoriteCard = page.locator("article").filter({ hasText: LISTING_TITLE }).first();
    await expect(favoriteCard).toBeVisible({ timeout: 30_000 });
    const removeFavoriteButton = favoriteCard.getByRole("button", {
      name: /إزالة من المفضلة|Remove from favorites/i,
    });
    await clickTwiceInSameTick(removeFavoriteButton);
    await expect(favoriteCard).toHaveCount(0);
    expect(favoriteDeletes).toBe(1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    await expect(page.getByText(/لا توجد إعلانات محفوظة|No saved listings/i)).toBeVisible({
      timeout: 30_000,
    });

    await page.goto("/saved-searches?q=سيارة&category=cat-vehicles&gov=gov-damascus", {
      waitUntil: "domcontentloaded",
    });
    await waitForHydration(page);
    await page.getByLabel(/اسم البحث المحفوظ|Saved search name/i).fill(SAVED_SEARCH_NAME);
    await page.getByLabel(/كلمة البحث|Search keyword/i).fill("سيارة");
    await page.getByLabel(/تكرار التنبيه|Alert frequency/i).first().selectOption("daily");

    const savedSearchForm = page
      .getByRole("button", { name: /حفظ البحث|Save search/i })
      .locator("xpath=ancestor::form");
    await submitTwiceInSameTick(savedSearchForm);

    const savedSearchRow = savedSearchItem(page, SAVED_SEARCH_NAME);
    await expect(savedSearchRow).toBeVisible({ timeout: 30_000 });
    await expect(savedSearchRow.getByLabel(/تكرار التنبيه|Alert frequency/i)).toHaveValue("daily");
    expect(savedSearchCreates).toBe(1);

    const frequencySelect = savedSearchRow.getByLabel(/تكرار التنبيه|Alert frequency/i);
    await changeSelectTwiceInSameTick(frequencySelect, "weekly");
    await expect(frequencySelect).toHaveValue("weekly");
    expect(savedSearchUpdates).toBe(1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    const restoredSavedSearchRow = savedSearchItem(page, SAVED_SEARCH_NAME);
    await expect(restoredSavedSearchRow).toBeVisible({ timeout: 30_000 });
    await expect(
      restoredSavedSearchRow.getByLabel(/تكرار التنبيه|Alert frequency/i),
    ).toHaveValue("weekly");

    const removeSavedSearchButton = restoredSavedSearchRow.getByRole("button", {
      name: /حذف البحث|Remove search/i,
    });
    await clickTwiceInSameTick(removeSavedSearchButton);
    await expect(restoredSavedSearchRow).toHaveCount(0);
    expect(savedSearchDeletes).toBe(1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    await expect(page.getByText(/لا توجد عمليات بحث محفوظة|No saved searches/i)).toBeVisible({
      timeout: 30_000,
    });

    expect(favoriteCreates).toBe(1);
    expect(favoriteDeletes).toBe(1);
    expect(savedSearchCreates).toBe(1);
    expect(savedSearchUpdates).toBe(1);
    expect(savedSearchDeletes).toBe(1);
    expect(remoteWrites).toEqual([]);
    expect(authorizedRequests).toEqual(
      expect.arrayContaining([
        "GET /api/profile",
        `GET /v1/listings/${LISTING_ID}/favorite`,
        `POST /v1/listings/${LISTING_ID}/favorite`,
        "GET /v1/account/favorites",
        `DELETE /v1/listings/${LISTING_ID}/favorite`,
        "GET /v1/account/saved-searches",
        "POST /v1/account/saved-searches",
        `PATCH /v1/account/saved-searches/${SAVED_SEARCH_ID}`,
        `DELETE /v1/account/saved-searches/${SAVED_SEARCH_ID}`,
      ]),
    );
  });
});

function savedSearchItem(page: Page, name: string): Locator {
  return page.locator("li").filter({ hasText: name }).first();
}

async function clickTwiceInSameTick(locator: Locator): Promise<void> {
  await locator.evaluate((element: HTMLButtonElement) => {
    element.click();
    element.click();
  });
}

async function submitTwiceInSameTick(form: Locator): Promise<void> {
  await form.evaluate((element: HTMLFormElement) => {
    element.requestSubmit();
    element.requestSubmit();
  });
}

async function changeSelectTwiceInSameTick(select: Locator, value: string): Promise<void> {
  await select.evaluate((element: HTMLSelectElement, nextValue) => {
    element.value = nextValue;
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function signIn(page: Page, returnTo: string): Promise<void> {
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`, {
    waitUntil: "domcontentloaded",
  });
  await waitForHydration(page);
  await page.getByLabel(/^(Email|البريد الإلكتروني)$/).fill("browser-smoke@rawa-j.test");
  await page.locator('form input[type="password"]').fill("Rawaj-E2E-Password-1");
  await page
    .locator("form")
    .getByRole("button", { name: /^(Log in|تسجيل الدخول)$/ })
    .click();
}

async function waitForHydration(page: Page): Promise<void> {
  await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1, {
    timeout: 30_000,
  });
}
