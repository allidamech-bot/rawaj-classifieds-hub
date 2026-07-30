import { expect, test, type Locator, type Page } from "@playwright/test";

const FIXTURE_TOKEN = "rawaj-e2e-firebase-token";
const UPDATED_PROFILE = {
  firstName: "علي",
  lastName: "الاختبار",
  displayName: "علي رواج التجريبي",
  governorate: "دمشق",
  cityArea: "المزة",
  businessName: "متجر رواج التجريبي",
  phone: "0933001122",
  whatsapp: "0933001133",
  preferredContactMethod: "whatsapp",
  bio: "حساب تجريبي لاختبار استعادة معلومات الملف الشخصي.",
} as const;

test.describe("authenticated launch-critical account profile journey", () => {
  test.setTimeout(120_000);

  test("saves once, restores, signs out cleanly, and restores on sign-in", async ({ page }) => {
    const remoteWrites: string[] = [];
    const authorizedRequests: string[] = [];
    let profilePatchRequests = 0;

    const resetResponse = await page.request.post("/__rawaj_e2e__/profile/reset", {
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
        url.pathname === "/v1/profile" ||
        url.pathname === "/v1/account/listings" ||
        url.pathname === "/v1/account/verifications";
      if (privateRequest) {
        expect(request.headers().authorization).toBe(`Bearer ${FIXTURE_TOKEN}`);
        authorizedRequests.push(`${method} ${url.pathname}`);
      }
      if (method === "PATCH" && url.pathname === "/v1/profile") {
        profilePatchRequests += 1;
      }
    });

    await page.addInitScript(() => {
      const marker = "rawaj:e2e:account-profile-storage-cleared";
      if (window.sessionStorage.getItem(marker) === "1") return;
      window.localStorage.clear();
      window.sessionStorage.setItem(marker, "1");
    });

    await signIn(page, "/profile");
    await expect(page).toHaveURL(/\/profile(?:[/?#]|$)/, { timeout: 30_000 });

    await expect(profileInput(page, /الاسم الأول|First name/i)).toHaveValue("مستخدم", {
      timeout: 30_000,
    });
    await expect(profileInput(page, /اسم العائلة|Last name/i)).toHaveValue("تجريبي");

    await profileInput(page, /الاسم الأول|First name/i).fill(UPDATED_PROFILE.firstName);
    await profileInput(page, /اسم العائلة|Last name/i).fill(UPDATED_PROFILE.lastName);
    await profileInput(page, /اسم العرض|Display name/i).fill(UPDATED_PROFILE.displayName);
    await profileInput(page, /المحافظة|Governorate/i).fill(UPDATED_PROFILE.governorate);
    await profileInput(page, /المدينة \/ المنطقة|City \/ area/i).fill(UPDATED_PROFILE.cityArea);
    await profileInput(page, /اسم المنشأة|Business name/i).fill(UPDATED_PROFILE.businessName);
    await profileInput(page, /الهاتف|Phone/i).fill(UPDATED_PROFILE.phone);
    await profileInput(page, /واتساب|WhatsApp/i).fill(UPDATED_PROFILE.whatsapp);
    await page
      .getByLabel(/طريقة التواصل المفضلة|Preferred contact method/i)
      .selectOption(UPDATED_PROFILE.preferredContactMethod);
    await page.getByLabel(/نبذة قصيرة|Short bio/i).fill(UPDATED_PROFILE.bio);

    const saveButton = page.getByRole("button", {
      name: /حفظ معلومات الحساب|Save account information/i,
    });
    const profileForm = saveButton.locator("xpath=ancestor::form");
    await submitTwiceInSameTick(profileForm);

    await expect(page.getByText(/تم حفظ معلومات الحساب وتحديثها|Account information saved/i)).toBeVisible(
      { timeout: 30_000 },
    );
    expect(profilePatchRequests).toBe(1);
    await assertUpdatedProfile(page);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    await assertUpdatedProfile(page);
    await expect(page.getByText(UPDATED_PROFILE.displayName).first()).toBeVisible();

    const logoutButton = page.getByRole("button", { name: /^(خروج|Log out)$/i });
    await clickTwiceInSameTick(logoutButton);
    await expect(page.getByRole("link", { name: /تسجيل الدخول|Log in/i }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(profileInput(page, /الاسم الأول|First name/i)).toHaveCount(0);
    await expect(page.getByText(UPDATED_PROFILE.phone, { exact: true })).toHaveCount(0);

    await signIn(page, "/profile");
    await expect(page).toHaveURL(/\/profile(?:[/?#]|$)/, { timeout: 30_000 });
    await assertUpdatedProfile(page);

    expect(profilePatchRequests).toBe(1);
    expect(remoteWrites).toEqual([]);
    expect(authorizedRequests).toEqual(
      expect.arrayContaining([
        "GET /api/profile",
        "PATCH /v1/profile",
        "GET /v1/account/listings",
        "GET /v1/account/verifications",
      ]),
    );
    expect(authorizedRequests.filter((entry) => entry === "GET /api/profile").length).toBeGreaterThanOrEqual(
      3,
    );
  });
});

function profileInput(page: Page, label: RegExp): Locator {
  return page.getByLabel(label).first();
}

async function assertUpdatedProfile(page: Page): Promise<void> {
  await expect(profileInput(page, /الاسم الأول|First name/i)).toHaveValue(
    UPDATED_PROFILE.firstName,
    { timeout: 30_000 },
  );
  await expect(profileInput(page, /اسم العائلة|Last name/i)).toHaveValue(UPDATED_PROFILE.lastName);
  await expect(profileInput(page, /اسم العرض|Display name/i)).toHaveValue(
    UPDATED_PROFILE.displayName,
  );
  await expect(profileInput(page, /المحافظة|Governorate/i)).toHaveValue(
    UPDATED_PROFILE.governorate,
  );
  await expect(profileInput(page, /المدينة \/ المنطقة|City \/ area/i)).toHaveValue(
    UPDATED_PROFILE.cityArea,
  );
  await expect(profileInput(page, /اسم المنشأة|Business name/i)).toHaveValue(
    UPDATED_PROFILE.businessName,
  );
  await expect(profileInput(page, /الهاتف|Phone/i)).toHaveValue(UPDATED_PROFILE.phone);
  await expect(profileInput(page, /واتساب|WhatsApp/i)).toHaveValue(UPDATED_PROFILE.whatsapp);
  await expect(page.getByLabel(/طريقة التواصل المفضلة|Preferred contact method/i)).toHaveValue(
    UPDATED_PROFILE.preferredContactMethod,
  );
  await expect(page.getByLabel(/نبذة قصيرة|Short bio/i)).toHaveValue(UPDATED_PROFILE.bio);
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
