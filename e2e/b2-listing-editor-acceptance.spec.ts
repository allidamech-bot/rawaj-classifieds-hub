import { expect, test, type Page } from "@playwright/test";
import { expectRenderedLayout } from "./layout-audit";

const approvedId = "00000000-0000-4000-8000-000000000071";
const fixtureHeader = "x-rawaj-e2e-owner-listing-lifecycle";

for (const language of ["ar", "en"] as const) {
  test(`B2.3 authenticated editor identity and safe read-only layout (${language})`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(150_000);
    const mobile = testInfo.project.name.startsWith("mobile");
    const desktop = testInfo.project.name.startsWith("desktop");
    test.skip(!mobile && !desktop, "Chromium acceptance project only");

    await page.setViewportSize({
      width: mobile ? 390 : 1024,
      height: mobile ? 844 : 900,
    });
    await page.setExtraHTTPHeaders({ [fixtureHeader]: "1" });
    await page.addInitScript((value) => localStorage.setItem("rawaj-language", value), language);

    await signIn(page, `/profile/listings/${approvedId}`);
    await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1, {
      timeout: 30_000,
    });
    await page.goto(`/profile/listings/${approvedId}`, { waitUntil: "domcontentloaded" });
    const editor = page.locator('main.rawaj-listing-studio-v4[data-studio-workflow="edit"]');
    await expect(editor).toBeVisible({ timeout: 45_000 });
    await expect(page.locator(".rawaj-app-shell")).toHaveAttribute("data-design-palette", "ivory");
    await expect(page.locator("html")).toHaveAttribute("dir", language === "ar" ? "rtl" : "ltr");
    await expect(editor.locator(".rawaj-studio-hero h1")).toBeVisible();
    await expect(editor.locator(".rawaj-studio-hero h1")).toHaveCSS("color", "rgb(249, 240, 228)");
    await expect(editor.locator(".rawaj-studio-shell")).toBeVisible();

    await expectRenderedLayout(page, {
      label: `B2.3 authenticated editor ${language} ${mobile ? 390 : 1024}px`,
      mobile,
    });

    const imagePath = testInfo.outputPath(`studio-edit-${language}.png`);
    await page.screenshot({ path: imagePath, fullPage: true, animations: "disabled" });
    await testInfo.attach(`studio-edit-${language}`, {
      path: imagePath,
      contentType: "image/png",
    });
  });
}

async function signIn(page: Page, returnTo: string): Promise<void> {
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1, {
    timeout: 30_000,
  });
  await page.getByLabel(/^(Email|البريد الإلكتروني)$/).fill("browser-smoke@rawa-j.test");
  await page.locator('form input[type="password"]').fill("Rawaj-E2E-Password-1");
  await page
    .locator("form")
    .getByRole("button", { name: /^(Log in|تسجيل الدخول)$/ })
    .click();
}
