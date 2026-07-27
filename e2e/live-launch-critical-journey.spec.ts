import { expect, test, type Locator, type Page } from "@playwright/test";
import { existsSync } from "node:fs";

const liveEnabled = process.env.RAWAJ_LIVE_E2E === "1";
const liveBaseUrl = process.env.RAWAJ_LIVE_BASE_URL?.trim();
const liveEmail = process.env.RAWAJ_LIVE_EMAIL?.trim();
const livePassword = process.env.RAWAJ_LIVE_PASSWORD;
const liveDisplayName = process.env.RAWAJ_LIVE_DISPLAY_NAME?.trim();
const liveImage = process.env.RAWAJ_LIVE_TEST_IMAGE?.trim();
const previewAccessUrl = process.env.RAWAJ_LIVE_PREVIEW_ACCESS_URL?.trim();
const adminEmail = process.env.RAWAJ_LIVE_ADMIN_EMAIL?.trim();
const adminPassword = process.env.RAWAJ_LIVE_ADMIN_PASSWORD;

const requiredConfiguration = [
  liveBaseUrl,
  liveEmail,
  livePassword,
  liveDisplayName,
  liveImage,
].every(Boolean);

test.describe("live launch-critical customer journey", () => {
  test.use({ baseURL: liveBaseUrl });
  test.setTimeout(300_000);

  test.skip(
    !liveEnabled || !requiredConfiguration,
    "Set RAWAJ_LIVE_E2E=1 and all required RAWAJ_LIVE_* account, URL, and image variables.",
  );

  test("registers or signs in, restores the session, uploads, and submits one listing", async ({
    page,
  }, testInfo) => {
    if (!existsSync(liveImage!)) {
      throw new Error(`Live test image does not exist: ${liveImage}`);
    }

    if (previewAccessUrl) {
      await page.goto(previewAccessUrl, { waitUntil: "domcontentloaded" });
    }

    await test.step("authenticate or register", async () => {
      const authenticationMode = await authenticateOrRegister(
        page,
        liveEmail!,
        livePassword!,
        liveDisplayName!,
      );
      testInfo.annotations.push({
        type: "authentication",
        description: authenticationMode,
      });
      await expect(page).toHaveURL(/\/add-listing(?:[/?#]|$)/, { timeout: 25_000 });
    });

    await test.step("restore the authenticated session after reload", async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/add-listing(?:[/?#]|$)/);
      await expect(
        page.getByText(/حوّل ما لديك إلى إعلان واضح|Turn what you have into a clear/i).first(),
      ).toBeVisible({ timeout: 30_000 });
    });

    await test.step("sign out and sign back in", async () => {
      await page.goto("/profile", { waitUntil: "domcontentloaded" });

      const logoutButton = page.getByRole("button", {
        name: /^(Log out|خروج)$/,
      });
      await expect(logoutButton).toBeVisible({ timeout: 20_000 });
      await logoutButton.click();

      await expect(logoutButton).toBeHidden({ timeout: 20_000 });
      await expect(
        page
          .locator("main")
          .getByRole("link", {
            name: /^(Log in|تسجيل الدخول)$/,
          })
          .first(),
      ).toBeVisible({ timeout: 20_000 });

      await login(page, liveEmail!, livePassword!, "/add-listing");
      await expect(page).toHaveURL(/\/add-listing(?:[/?#]|$)/, { timeout: 25_000 });
    });

    const listingTitle = `اختبار رواج المباشر ${Date.now()}`;
    let listingId = "";

    await test.step("choose a final category and enter the title", async () => {
      await waitForPostingForm(page);
      await chooseFirstFinalCategory(page);

      const titleInput = page.getByPlaceholder(
        /مثال: سيارة كيا سيراتو|Example: Kia Cerato/i,
      );
      await titleInput.fill(listingTitle);

      await page.getByRole("button", { name: /^(Continue|متابعة)$/ }).click();
      await expect(
        page.getByRole("heading", {
          name: /^(Listing photos|صور الإعلان)$/,
        }),
      ).toBeVisible({ timeout: 20_000 });
    });

    await test.step("select an image and complete listing details", async () => {
      await page.locator('input[type="file"][accept*="image"]').setInputFiles(liveImage!);
      await expect(page.locator(".rawaj-studio-media-card")).toHaveCount(1, {
        timeout: 15_000,
      });

      const description = page.locator("main textarea:visible").first();
      await description.fill(
        "هذا إعلان اختبار آلي مباشر للتحقق من إنشاء المسودة ورفع الصورة وإرسال الإعلان للمراجعة عبر رواج.",
      );

      await completeVisibleDetailControls(page);

      await page.getByRole("button", { name: /^(Continue|متابعة)$/ }).click();

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

      await expect(
        page.getByRole("heading", {
          name: /^(Price and location|السعر والموقع)$/,
        }),
      ).toBeVisible({ timeout: 25_000 });
    });

    await test.step("complete price and location", async () => {
      const priceInput = page.locator('main input[inputmode="numeric"]:visible').first();
      await expect(priceInput).toBeVisible();
      await priceInput.fill("125000");

      const contactNameInput = page.getByLabel(/^(Contact name|اسم التواصل)$/).first();
      if (await contactNameInput.isVisible().catch(() => false)) {
        await contactNameInput.fill(liveDisplayName!);
      }

      const locationSearch = page
        .getByPlaceholder(/ابحث باسم المكان أو اسمه الشائع|Search location or common name/i)
        .last();
      await selectLocationFromSearch(locationSearch);

      await page.getByRole("button", { name: /^(Continue|متابعة)$/ }).click();

      await expect(
        page.getByRole("heading", {
          name: /^(Review before submitting|راجع الإعلان قبل الإرسال)$/,
        }),
      ).toBeVisible({ timeout: 25_000 });
    });

    await test.step("upload to R2 and submit for review", async () => {
      await page.getByRole("button", {
        name: /^(Submit for review|إرسال للمراجعة)$/,
      }).click();

      const submissionStatus = page.locator(".rawaj-studio-success[role='status']");
      await expect(submissionStatus).toBeVisible({ timeout: 150_000 });

      const submissionText = (await submissionStatus.innerText()).trim();
      if (!/تم إرسال الإعلان للمراجعة|Listing sent for review/i.test(submissionText)) {
        throw new Error(`Listing was not submitted for review: ${submissionText}`);
      }

      const manageButton = page.getByRole("button", {
        name: /^(Manage listing|إدارة الإعلان)$/,
      });
      await expect(manageButton).toBeVisible();
      await manageButton.click();

      await expect(page).toHaveURL(/\/profile\/listings\/[^/?#]+/, {
        timeout: 20_000,
      });
      listingId = new URL(page.url()).pathname.split("/").filter(Boolean).at(-1) ?? "";

      expect(listingId).not.toBe("");
      testInfo.annotations.push({
        type: "submitted-listing-id",
        description: listingId,
      });
    });

    if (!adminEmail || !adminPassword) {
      testInfo.annotations.push({
        type: "moderation-follow-up",
        description:
          "RAWAJ_LIVE_ADMIN_EMAIL and RAWAJ_LIVE_ADMIN_PASSWORD were not supplied; verify the reported listing ID in /admin/pending with an authorized account.",
      });
    }
  });
});

async function authenticateOrRegister(
  page: Page,
  email: string,
  password: string,
  displayName: string,
): Promise<"existing-account-login" | "new-account-registration"> {
  await page.goto("/login?returnTo=/add-listing", {
    waitUntil: "domcontentloaded",
  });

  await fillAuthenticationCredentials(page, email, password);
  await page
    .locator("form")
    .getByRole("button", { name: /^(Log in|تسجيل الدخول)$/ })
    .click();

  const loginSucceeded = await page
    .waitForURL(/\/add-listing(?:[/?#]|$)/, { timeout: 12_000 })
    .then(() => true)
    .catch(() => false);

  if (loginSucceeded) return "existing-account-login";

  const registerTab = page
    .locator(".rawaj-auth-tabs")
    .getByRole("button", { name: /^(Register|إنشاء حساب)$/ });

  await expect(registerTab).toBeVisible({ timeout: 10_000 });
  await registerTab.click();

  await page.getByLabel(/^(Account name|اسم الحساب)$/).fill(displayName);
  await page.getByLabel(/^(Email|البريد الإلكتروني)$/).fill(email);
  await page.locator('form input[type="password"]').fill(password);
  await page
    .locator("form")
    .getByRole("button", { name: /^(Register|إنشاء حساب)$/ })
    .click();

  await expect(page).toHaveURL(/\/add-listing(?:[/?#]|$)/, {
    timeout: 25_000,
  });

  return "new-account-registration";
}

async function login(
  page: Page,
  email: string,
  password: string,
  returnTo: string,
): Promise<void> {
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`, {
    waitUntil: "domcontentloaded",
  });
  await fillAuthenticationCredentials(page, email, password);
  await page
    .locator("form")
    .getByRole("button", { name: /^(Log in|تسجيل الدخول)$/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(returnTo)}(?:[/?#]|$)`), {
    timeout: 25_000,
  });
}

async function fillAuthenticationCredentials(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.getByLabel(/^(Email|البريد الإلكتروني)$/).fill(email);
  await page.locator('form input[type="password"]').fill(password);
}

async function waitForPostingForm(page: Page): Promise<void> {
  const taxonomySelector = page.locator('[data-listing-taxonomy-selector="true"]');
  const setupError = page.getByRole("heading", {
    name: /Could not prepare posting form|تعذر تجهيز نموذج النشر/i,
  });

  await Promise.race([
    taxonomySelector.waitFor({ state: "visible", timeout: 35_000 }),
    setupError.waitFor({ state: "visible", timeout: 35_000 }),
  ]).catch(() => undefined);

  if (await setupError.isVisible().catch(() => false)) {
    const errorCard = setupError.locator("xpath=..");
    throw new Error(`Posting form setup failed: ${(await errorCard.innerText()).trim()}`);
  }

  await expect(taxonomySelector).toBeVisible({ timeout: 35_000 });
}

async function chooseFirstFinalCategory(page: Page): Promise<void> {
  const selector = page.locator('[data-listing-taxonomy-selector="true"]');
  const finalStatus = selector.getByText(
    /تم اختيار التصنيف النهائي|Final category selected/i,
  );

  for (let depth = 0; depth < 12; depth += 1) {
    if (await finalStatus.isVisible().catch(() => false)) return;

    const options = selector.getByRole("listitem");
    const optionCount = await options.count();
    if (optionCount === 0) {
      throw new Error("The selected taxonomy path has no final category.");
    }

    await options.first().click();
    await page.waitForTimeout(300);
  }

  throw new Error("Could not reach a final taxonomy category within 12 levels.");
}

async function completeVisibleDetailControls(page: Page): Promise<void> {
  const main = page.locator("main");

  for (let pass = 0; pass < 6; pass += 1) {
    const selects = main.locator("select:visible:not([disabled])");
    for (let index = 0; index < (await selects.count()); index += 1) {
      const select = selects.nth(index);
      if ((await select.inputValue()) !== "") continue;

      const firstValue = await select.evaluate((element: HTMLSelectElement) => {
        const option = Array.from(element.options).find(
          (candidate) => candidate.value !== "" && !candidate.disabled,
        );
        return option?.value ?? "";
      });

      if (firstValue) await select.selectOption(firstValue);
    }

    const textareas = main.locator("textarea:visible:not([disabled])");
    for (let index = 0; index < (await textareas.count()); index += 1) {
      const textarea = textareas.nth(index);
      if ((await textarea.inputValue()).trim()) continue;
      await textarea.fill(
        "تفاصيل اختبار واضحة وكاملة للتحقق من حقول التصنيف وإرسال الإعلان بصورة صحيحة.",
      );
    }

    const inputs = main.locator(
      'input:visible:not([disabled]):not([type="file"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="search"])',
    );

    for (let index = 0; index < (await inputs.count()); index += 1) {
      const input = inputs.nth(index);
      if ((await input.inputValue()).trim()) continue;

      const type = (await input.getAttribute("type")) ?? "text";
      if (type === "number") {
        await input.fill(await suitableNumericValue(input));
      } else if (type === "date") {
        await input.fill("2026-01-15");
      } else if (type === "tel") {
        await input.fill("+963944000000");
      } else {
        await input.fill("اختبار رواج مباشر");
      }
    }

    const searchInputs = main.getByPlaceholder(
      /ابحث باسم المكان أو اسمه الشائع|Search location or common name/i,
    );
    for (let index = 0; index < (await searchInputs.count()); index += 1) {
      const input = searchInputs.nth(index);
      if (await input.isVisible().catch(() => false)) {
        await selectLocationFromSearch(input);
      }
    }

    const checkboxes = main.locator('input[type="checkbox"]:visible:not([disabled])');
    for (let index = 0; index < (await checkboxes.count()); index += 1) {
      const checkbox = checkboxes.nth(index);
      if (!(await checkbox.isChecked())) await checkbox.check();
    }

    await page.waitForTimeout(500);
  }
}

async function suitableNumericValue(input: Locator): Promise<string> {
  const minRaw = await input.getAttribute("min");
  const maxRaw = await input.getAttribute("max");
  const min = minRaw === null ? Number.NaN : Number(minRaw);
  const max = maxRaw === null ? Number.NaN : Number(maxRaw);

  let value = 1;
  if (Number.isFinite(min) && min >= 1900 && (!Number.isFinite(max) || max <= 2200)) {
    value = Math.max(min, Math.min(Number.isFinite(max) ? max : 2026, 2026));
  } else if (Number.isFinite(min)) {
    value = Math.max(min, 1);
  }

  if (Number.isFinite(max)) value = Math.min(value, max);
  return String(value);
}

async function selectLocationFromSearch(searchInput: Locator): Promise<void> {
  if (!(await searchInput.isVisible().catch(() => false))) return;

  for (const query of ["دمشق", "Damascus"]) {
    await searchInput.fill(query);

    const resultButtons = searchInput
      .locator("xpath=following-sibling::div[1]")
      .locator("button");

    const appeared = await resultButtons
      .first()
      .waitFor({ state: "visible", timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    if (!appeared) continue;

    const preciseResults = resultButtons.filter({
      hasText: /حي|مدينة|منطقة|بلدة|قرية|City|District|Area|Town|Village/i,
    });

    if ((await preciseResults.count()) > 0) {
      await preciseResults.last().click();
    } else {
      await resultButtons.last().click();
    }

    await expect(searchInput).toHaveValue("", { timeout: 8_000 });
    return;
  }

  throw new Error("No usable location search result was returned.");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
