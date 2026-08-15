import { expect, test, type Locator, type Page } from "@playwright/test";

const FIXTURE_TOKEN = "rawaj-e2e-firebase-token";
const VALID_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test.describe("authenticated launch-critical journey", () => {
  test.setTimeout(120_000);

  test("signs in, restores the session, creates a draft, uploads, and submits", async ({
    page,
  }) => {
    const remoteWrites: string[] = [];
    const authorizedPrivateRequests: string[] = [];

    page.on("request", (request) => {
      const url = new URL(request.url());
      const isWrite = request.method() !== "GET" && request.method() !== "HEAD";
      const isLocal = ["127.0.0.1", "localhost"].includes(url.hostname);
      if (isWrite && !isLocal) remoteWrites.push(`${request.method()} ${request.url()}`);

      const isPrivate =
        url.pathname.startsWith("/api/") ||
        url.pathname.startsWith("/v1/account/") ||
        (url.pathname.startsWith("/v1/listings") && request.method() !== "GET") ||
        url.pathname.startsWith("/v1/listing-images/");
      if (isPrivate) {
        expect(request.headers().authorization).toBe(`Bearer ${FIXTURE_TOKEN}`);
        authorizedPrivateRequests.push(`${request.method()} ${url.pathname}`);
      }
    });

    await page.addInitScript(() => {
      const marker = "rawaj:e2e:storage-cleared";
      if (window.sessionStorage.getItem(marker) === "1") return;
      window.localStorage.clear();
      window.sessionStorage.setItem(marker, "1");
    });
    await page.goto("/login?returnTo=/add-listing", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    await page.getByLabel(/^(Email|البريد الإلكتروني)$/).fill("browser-smoke@rawa-j.test");
    await page.locator('form input[type="password"]').fill("Rawaj-E2E-Password-1");
    await page
      .locator("form")
      .getByRole("button", { name: /^(Log in|تسجيل الدخول)$/ })
      .click();

    await expect(page).toHaveURL(/\/add-listing(?:[/?#]|$)/, { timeout: 20_000 });
    await expect(page.locator('[data-listing-taxonomy-selector="true"]')).toBeVisible({
      timeout: 30_000,
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    await expect(page).toHaveURL(/\/add-listing(?:[/?#]|$)/);
    await expect(page.locator('[data-listing-taxonomy-selector="true"]')).toBeVisible({
      timeout: 30_000,
    });

    await chooseFirstFinalCategory(page);
    await page
      .getByPlaceholder(/مثال: سيارة كيا سيراتو|Example: Kia Cerato/i)
      .fill("سيارة تجريبية لاختبار رحلة النشر");
    await page.getByRole("button", { name: /^(Continue|متابعة)$/ }).click();

    await expect(page.getByRole("heading", { name: /^(Listing photos|صور الإعلان)$/ })).toBeVisible(
      { timeout: 20_000 },
    );
    await page.locator('input[type="file"][accept*="image"]').setInputFiles({
      name: "rawaj-e2e.png",
      mimeType: "image/png",
      buffer: VALID_PNG,
    });
    await expect(page.locator(".rawaj-studio-media-card")).toHaveCount(1, { timeout: 15_000 });

    await page
      .locator("main textarea:visible")
      .first()
      .fill("إعلان تجريبي محلي للتحقق من المسودة والصورة والإرسال إلى المراجعة.");
    await completeVisibleDetailControls(page);
    await advanceUntilPriceAndLocation(page);

    const priceInput = page.locator('main input[inputmode="numeric"]:visible').first();
    await expect(priceInput).toBeVisible();
    await priceInput.fill("125000");
    await selectLocationFromSearch(
      page
        .getByPlaceholder(/ابحث باسم المكان أو اسمه الشائع|Search location or common name/i)
        .last(),
    );
    await page.getByRole("button", { name: /^(Continue|متابعة)$/ }).click();

    await expect(
      page.getByRole("heading", { name: /^(Review before submitting|راجع الإعلان قبل الإرسال)$/ }),
    ).toBeVisible({ timeout: 25_000 });
    await page.getByRole("button", { name: /^(Submit for review|إرسال للمراجعة)$/ }).click();

    const success = page.locator(".rawaj-studio-success[role='status']");
    await expect(success).toContainText(/تم إرسال الإعلان للمراجعة|Listing sent for review/i, {
      timeout: 45_000,
    });

    await dismissPostSubmitSharePrompt(page);
    await page.getByRole("link", { name: /^(Manage listing|إدارة الإعلان)$/ }).click();
    await expect(page).toHaveURL(/\/profile\/listings\/e2e-owner-listing-\d+/, {
      timeout: 20_000,
    });

    expect(remoteWrites).toEqual([]);
    expect(authorizedPrivateRequests).toEqual(
      expect.arrayContaining([
        "GET /api/profile",
        "POST /v1/listings",
        expect.stringMatching(/^PUT \/v1\/listings\/[^/]+\/taxonomy$/),
        expect.stringMatching(/^POST \/v1\/listings\/[^/]+\/images$/),
        expect.stringMatching(/^PATCH \/v1\/listings\/[^/]+$/),
      ]),
    );
  });
});

async function waitForHydration(page: Page): Promise<void> {
  await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1, {
    timeout: 30_000,
  });
}

async function dismissPostSubmitSharePrompt(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", {
    name: /شارك إعلانك من الآن واجذب المهتمين|Share now and start attracting buyers/i,
  });
  const appeared = await dialog
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return;

  await dialog.getByRole("button", { name: /^(Maybe later|لاحقاً)$/ }).click();
  await expect(dialog).toBeHidden({ timeout: 5_000 });
}

async function chooseFirstFinalCategory(page: Page): Promise<void> {
  const selector = page.locator('[data-listing-taxonomy-selector="true"]');
  const finalStatus = selector.getByText(/تم اختيار التصنيف النهائي|Final category selected/i);

  for (let depth = 0; depth < 12; depth += 1) {
    if (await finalStatus.isVisible().catch(() => false)) return;
    const options = selector.getByRole("listitem");
    if ((await options.count()) === 0) throw new Error("No taxonomy option was available.");
    await options.first().click();
    await page.waitForTimeout(200);
  }
  throw new Error("Could not select a final taxonomy category.");
}

async function advanceUntilPriceAndLocation(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (
      await page
        .getByRole("heading", { name: /^(Price and location|السعر والموقع)$/ })
        .isVisible()
        .catch(() => false)
    ) {
      return;
    }
    await completeVisibleDetailControls(page);
    await page.getByRole("button", { name: /^(Continue|متابعة)$/ }).click();
  }

  await expect(
    page.getByRole("heading", { name: /^(Price and location|السعر والموقع)$/ }),
  ).toBeVisible({ timeout: 20_000 });
}

async function completeVisibleDetailControls(page: Page): Promise<void> {
  const main = page.locator("main");
  const selects = main.locator("select:visible:not([disabled])");
  for (let index = 0; index < (await selects.count()); index += 1) {
    const select = selects.nth(index);
    if ((await select.inputValue()) !== "") continue;
    const value = await select.evaluate(
      (element: HTMLSelectElement) =>
        Array.from(element.options).find((option) => option.value && !option.disabled)?.value ?? "",
    );
    if (value) await select.selectOption(value);
  }

  const inputs = main.locator(
    'input:visible:not([disabled]):not([type="file"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="search"])',
  );
  for (let index = 0; index < (await inputs.count()); index += 1) {
    const input = inputs.nth(index);
    if ((await input.inputValue()).trim()) continue;
    const type = (await input.getAttribute("type")) ?? "text";
    const inputMode = (await input.getAttribute("inputmode")) ?? "";
    if (type === "number" || inputMode === "numeric" || inputMode === "decimal") {
      await input.fill(await suitableNumericValue(input));
    } else if (type === "date") await input.fill("2026-01-15");
    else if (type === "tel") await input.fill("+963944000000");
    else await input.fill("اختبار رواج");
  }
}

async function suitableNumericValue(input: Locator): Promise<string> {
  const min = Number((await input.getAttribute("min")) ?? Number.NaN);
  const max = Number((await input.getAttribute("max")) ?? Number.NaN);
  let value = Number.isFinite(min) ? Math.max(min, 1) : 1;
  if (Number.isFinite(min) && min >= 1900) value = 2026;
  if (Number.isFinite(max)) value = Math.min(value, max);
  return String(value);
}

async function selectLocationFromSearch(searchInput: Locator): Promise<void> {
  await expect(searchInput).toBeVisible();
  await searchInput.fill("دمشق");
  const results = searchInput.locator("xpath=following-sibling::div[1]").locator("button");
  await expect(results.first()).toBeVisible({ timeout: 8_000 });
  await results.last().click();
  await expect(searchInput).toHaveValue("");
}