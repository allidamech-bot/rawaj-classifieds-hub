import { expect, test } from "@playwright/test";
import { expectRenderedLayout } from "./layout-audit";

const viewports = [
  { name: "mobile-360", width: 360, height: 800, project: "mobile" },
  { name: "mobile-390", width: 390, height: 844, project: "mobile" },
  { name: "mobile-412", width: 412, height: 915, project: "mobile" },
  { name: "desktop-1440", width: 1440, height: 1000, project: "desktop" },
] as const;

const routes = [
  { name: "home", path: "/" },
  { name: "categories", path: "/categories" },
  { name: "listings", path: "/listings" },
  { name: "offers", path: "/offers" },
  { name: "login", path: "/login" },
  { name: "reset-password-invalid", path: "/reset-password" },
  { name: "add-listing", path: "/add-listing" },
  { name: "account", path: "/profile" },
  { name: "my-listings", path: "/profile/listings" },
  { name: "favorites", path: "/favorites" },
  { name: "saved-searches", path: "/saved-searches" },
  { name: "notifications", path: "/notifications" },
  { name: "activity", path: "/activity" },
  { name: "chats", path: "/chats" },
  { name: "more", path: "/more" },
  { name: "support", path: "/support" },
  { name: "safety", path: "/safety" },
  { name: "verification", path: "/verification" },
  { name: "promotion", path: "/promotion" },
  { name: "terms", path: "/terms" },
  { name: "privacy", path: "/privacy" },
  { name: "prohibited", path: "/prohibited" },
  { name: "admin", path: "/admin" },
  { name: "not-found", path: "/__rawaj_visual_audit_not_found__" },
] as const;

for (const viewport of viewports) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of routes) {
      test(`${route.name} rendered layout audit`, async ({ page }, testInfo) => {
        test.skip(
          !testInfo.project.name.startsWith(viewport.project),
          `${viewport.name} belongs to the ${viewport.project} project`,
        );
        const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
        expect(response?.status() ?? 200).toBeLessThan(500);
        await expect(page.locator("main")).toBeVisible();
        await page.addStyleTag({
          content: 'aside[data-placement-loading="true"]{display:none!important}',
        });
        await page.waitForTimeout(250);

        await expectRenderedLayout(page, {
          label: `${viewport.name}:${route.name}`,
          mobile: viewport.project === "mobile",
        });

        await page.screenshot({
          path: testInfo.outputPath(`${viewport.name}-${route.name}.png`),
          fullPage: true,
          animations: "disabled",
        });
      });
    }
  });
}
