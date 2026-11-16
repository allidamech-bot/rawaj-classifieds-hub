import { expect, test } from "@playwright/test";
import { expectRenderedLayout } from "./layout-audit";

const viewports = [
  { name: "mobile-320", width: 320, height: 700, project: "mobile", homeOnly: true },
  { name: "mobile-360", width: 360, height: 800, project: "mobile" },
  { name: "mobile-390", width: 390, height: 844, project: "mobile" },
  { name: "mobile-412", width: 412, height: 915, project: "mobile" },
  { name: "mobile-430", width: 430, height: 932, project: "mobile" },
  { name: "tablet-768", width: 768, height: 1024, project: "desktop" },
  { name: "desktop-1440", width: 1440, height: 1000, project: "desktop" },
] as const;

const routes = [
  { name: "home", path: "/" },
  { name: "categories", path: "/categories" },
  { name: "governorate-damascus", path: "/syria/damascus", focused: true },
  { name: "category-vehicles", path: "/category/vehicles" },
  { name: "category-real-estate", path: "/category/real-estate" },
  { name: "category-phones", path: "/category/phones" },
  { name: "listings", path: "/listings" },
  {
    name: "listing-detail",
    path: "/listings/e2e-listing-featured",
  },
  { name: "offers", path: "/offers" },
  {
    name: "seller-storefront",
    path: "/seller/00000000-0000-4000-8000-000000000010",
  },
  { name: "login", path: "/login" },
  { name: "reset-password-invalid", path: "/reset-password" },
  { name: "auth-callback-invalid", path: "/auth/callback", settlesAt: "/login" },
  { name: "add-listing", path: "/add-listing" },
  { name: "account", path: "/profile" },
  { name: "my-listings", path: "/profile/listings" },
  {
    name: "owner-listing-editor-guest",
    path: "/profile/listings/00000000-0000-4000-8000-000000000071",
    focused: true,
  },
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
  { name: "promotion-request-guest", path: "/promotion-request", focused: true },
  { name: "terms", path: "/terms" },
  { name: "privacy", path: "/privacy" },
  { name: "prohibited", path: "/prohibited" },
  { name: "admin", path: "/admin" },
  { name: "admin-pending", path: "/admin/pending" },
  { name: "admin-listings", path: "/admin/listings" },
  { name: "admin-data-quality", path: "/admin/data-quality" },
  { name: "admin-reviews", path: "/admin/reviews" },
  { name: "admin-reports", path: "/admin/reports" },
  { name: "admin-message-reports", path: "/admin/message-reports" },
  { name: "admin-safety", path: "/admin/safety" },
  { name: "admin-verifications", path: "/admin/verifications" },
  { name: "admin-users", path: "/admin/users" },
  { name: "admin-promotions", path: "/admin/promotions" },
  { name: "admin-ad-placements", path: "/admin/ad-placements" },
  { name: "admin-campaigns", path: "/admin/campaigns" },
  { name: "admin-audit", path: "/admin/audit" },
  { name: "admin-notifications", path: "/admin/notifications" },
  { name: "admin-owner-controls", path: "/admin/owner-controls" },
  { name: "not-found", path: "/__rawaj_visual_audit_not_found__", expectedStatus: 404 },
] as const;

for (const viewport of viewports) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of routes) {
      if ("homeOnly" in viewport && route.name !== "home") continue;
      // Complete route coverage without multiplying screenshot time across all sizes.
      // Additional focused B4 fixtures cover 390px mobile and 1440px desktop states.
      // Admin notifications follow the full matrix (also owned by B3.4).
      if ("focused" in route && viewport.name !== "mobile-390" && viewport.name !== "desktop-1440")
        continue;
      test(`${route.name} rendered layout audit`, async ({ page }, testInfo) => {
        test.skip(
          !testInfo.project.name.startsWith(viewport.project),
          `${viewport.name} belongs to the ${viewport.project} project`,
        );
        const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
        const expectedStatus = "expectedStatus" in route ? route.expectedStatus : 200;
        expect(response?.status() ?? 200).toBe(expectedStatus);
        if ("settlesAt" in route) {
          await page.waitForURL((url) => url.pathname === route.settlesAt);
        }
        await expect(page.locator("main")).toBeVisible();
        await page.addStyleTag({
          content: 'aside[data-placement-loading="true"]{display:none!important}',
        });
        await expect(page.locator('html[data-rawaj-a11y-ready="true"]')).toHaveCount(1);
        await page.waitForTimeout(50);

        await expectRenderedLayout(page, {
          label: `${viewport.name}:${route.name}`,
          mobile: viewport.project === "mobile",
        });

        if (route.name === "categories") {
          await expect(page.locator(".rawaj-shell-header--context")).toHaveCSS(
            "background-color",
            "rgb(7, 56, 54)",
          );
        }
        if (route.name === "add-listing") {
          const step = page.locator(
            ".rawaj-listing-studio-v4 .rawaj-studio-steps li[data-state='active'] .rawaj-studio-steps__index",
          );
          if (await step.count()) {
            await expect(step).toHaveCSS("background-image", "none");
          } else {
            // The signed-out fixture intentionally renders the authentication
            // gate, not an editor. Authenticated stepper rendering is checked by
            // the separate listing-studio fixture suite.
            await expect(page.locator("main a[href*='/login']").first()).toBeVisible();
          }
        }
        if (route.name === "offers") {
          await expect(page.locator(".rawaj-offers-results")).toHaveCSS("background-image", "none");
        }
        if (["terms", "privacy", "prohibited", "promotion"].includes(route.name)) {
          const card = page.locator(".rawaj-policy-card, .rawaj-promotion-card").first();
          await expect(card).toHaveCSS("background-color", "rgb(252, 248, 242)");
          await expect(card).toHaveCSS("background-image", "none");
        }

        await page.screenshot({
          path: testInfo.outputPath(`${viewport.name}-${route.name}.png`),
          fullPage: true,
          animations: "disabled",
        });
      });
    }
  });
}
