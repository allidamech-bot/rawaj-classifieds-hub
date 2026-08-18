import { expect, test, type Page } from "@playwright/test";
import { expectRenderedLayout } from "./layout-audit";

const authenticatedRoutes = [
  { name: "account", path: "/profile" },
  { name: "my-listings", path: "/profile/listings" },
  { name: "add-listing", path: "/add-listing" },
  { name: "chats", path: "/chats" },
  { name: "favorites", path: "/favorites" },
  { name: "saved-searches", path: "/saved-searches" },
  { name: "activity", path: "/activity" },
  { name: "notifications", path: "/notifications" },
  { name: "verification", path: "/verification" },
  { name: "promotion", path: "/promotion" },
  { name: "more", path: "/more" },
] as const;

test.describe("authenticated rendered visual QA", () => {
  test.setTimeout(240_000);

  test("authenticated personal surfaces stay visually and structurally coherent", async ({
    page,
  }, testInfo) => {
    const mobile = testInfo.project.name.startsWith("mobile");
    const desktop = testInfo.project.name.startsWith("desktop");
    test.skip(!mobile && !desktop, "Only browser visual projects are relevant");

    await signIn(page, "/profile");
    await expect(page).toHaveURL(/\/profile(?:[/?#]|$)/, { timeout: 30_000 });

    for (const route of authenticatedRoutes) {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 200).toBe(200);
      await waitForHydration(page);
      await expect(page.locator("main")).toBeVisible();
      await page.addStyleTag({
        content: 'aside[data-placement-loading="true"]{display:none!important}',
      });
      await expect(page.locator('html[data-rawaj-a11y-ready="true"]')).toHaveCount(1);
      await page.waitForTimeout(75);

      await expectRenderedLayout(page, {
        label: `authenticated:${testInfo.project.name}:${route.name}`,
        mobile,
      });

      await page.screenshot({
        path: testInfo.outputPath(`authenticated-${route.name}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
  });
});

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
