import { expect, test } from "@playwright/test";

/**
 * The migrated RAWAJ routes have an approved petrol/ivory identity. This
 * acceptance asserts the actual rendered shell across Arabic/English and
 * iPhone/desktop, not merely successful CSS compilation.
 * Runs only against isolated local fixtures; never writes production data.
 */
const ivoryRoutes = [
  "/categories",
  "/listings",
  "/offers",
  "/login",
  "/reset-password",
  "/more",
  "/profile",
  "/favorites",
  "/saved-searches",
  "/activity",
  "/notifications",
  "/chats",
  "/support",
] as const;

for (const pathname of ivoryRoutes) {
  for (const language of ["ar", "en"] as const) {
    test(`approved ivory route: ${pathname} (${language})`, async ({ page }, testInfo) => {
      test.skip(process.env.RAWAJ_E2E_USE_FIXTURES !== "1", "Isolated fixture browser only");
      const mobile = testInfo.project.name.startsWith("mobile");
      await page.setViewportSize({
        width: mobile ? 390 : 1440,
        height: mobile ? 844 : 900,
      });
      await page.addInitScript((value) => localStorage.setItem("rawaj-language", value), language);
      const response = await page.goto(pathname, { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 200, pathname).toBe(200);
      await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
      const shell = page.locator(".rawaj-app-shell");
      await expect(shell).toHaveAttribute("data-design-palette", "ivory");
      await expect(shell).toHaveCSS("color-scheme", "light");
      await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
      await expect(page.locator("html")).toHaveCSS("background-color", "rgb(249, 240, 228)");
      await expect(page.locator("main")).toBeVisible();

      if (pathname === "/categories") {
        await expect(page.locator(".rawaj-categories-v2__hero-search input")).toHaveCSS(
          "color",
          "rgb(19, 39, 36)",
        );
      }
      if (pathname === "/login") {
        await expect(page.locator(".rawaj-auth-layout")).toHaveCSS(
          "background-color",
          "rgb(255, 250, 243)",
        );
      }
      if (pathname === "/offers") {
        await expect(page.locator(".rawaj-offers-stage")).toHaveCSS(
          "background-color",
          "rgb(7, 56, 54)",
        );
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${pathname} ${language} must fit ${mobile ? "iPhone" : "desktop"}`,
      ).toBeLessThanOrEqual(mobile ? 391 : 1441);
    });
  }
}

for (const pathname of ["/", "/seller/90fc1187-0357-46da-9c19-d984536df794"] as const) {
  test(`preserve pre-approved homepage/storefront route: ${pathname}`, async ({ page }) => {
    test.skip(process.env.RAWAJ_E2E_USE_FIXTURES !== "1", "Isolated fixture browser only");
    await page.goto(pathname, { waitUntil: "domcontentloaded" });
    await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
    await expect(page.locator(".rawaj-app-shell")).not.toHaveAttribute(
      "data-design-palette",
      "ivory",
    );
    await expect(page.locator("main")).toBeVisible();
  });
}

/**
 * Admin has a separate approved workspace design rather than the generic
 * ivory route flag. Inspect every authorized fixture route, not just its
 * signed-out gate, for retired V17–V20 chromatic and charcoal paints.
 */
const adminWorkspaceRoutes = [
  "/admin",
  "/admin/pending",
  "/admin/listings",
  "/admin/data-quality",
  "/admin/reviews",
  "/admin/reports",
  "/admin/message-reports",
  "/admin/safety",
  "/admin/verifications",
  "/admin/users",
  "/admin/promotions",
  "/admin/ad-placements",
  "/admin/campaigns",
  "/admin/audit",
  "/admin/notifications",
  "/admin/owner-controls",
] as const;

for (const language of ["ar", "en"] as const) {
  test(`admin workspace paint audit: ${language}`, async ({ page }, testInfo) => {
    test.skip(process.env.RAWAJ_E2E_USE_FIXTURES !== "1", "Local owner fixtures only");
    test.setTimeout(240_000);
    const mobile = testInfo.project.name.startsWith("mobile");
    await page.setViewportSize({
      width: mobile ? 390 : 1440,
      height: mobile ? 844 : 900,
    });
    await page.addInitScript((value) => {
      localStorage.setItem("rawaj-language", value);
      localStorage.setItem("rawaj:e2e:firebase-user", "{}");
    }, language);
    await page.route("**/api/profile", async (route) => {
      expect(new URL(route.request().url()).hostname).toBe("127.0.0.1");
      const response = await route.fetch();
      const payload = await response.json();
      await route.fulfill({
        response,
        json: { data: { ...payload.data, roles: ["owner"] } },
      });
    });
    await page.route("**/v1/admin/**", async (route) => {
      expect(new URL(route.request().url()).hostname).toBe("127.0.0.1");
      expect(route.request().method()).toBe("GET");
      await route.fulfill({
        status: 503,
        json: {
          error: {
            code: "service_unavailable",
            message: "Isolated admin fixture",
          },
        },
      });
    });
    for (const pathname of adminWorkspaceRoutes) {
      await page.goto(pathname, { waitUntil: "domcontentloaded" });
      await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
      const main = page.locator("main.rawaj-admin-v3");
      await expect(main).toBeVisible();
      const nav = page.getByRole("navigation", {
        name: language === "ar" ? "تنقل الإدارة" : "Admin navigation",
      });
      await expect(nav.locator('a[aria-current="page"]')).toHaveAttribute("href", pathname);
      await expect(main).toHaveCSS("color", "rgb(19, 39, 36)");

      const collisions = await page.evaluate(() => {
        const retiredRgb = [
          "219, 73, 179",
          "198, 44, 120",
          "155, 40, 111",
          "116, 101, 239",
          "36, 37, 41",
          "25, 29, 39",
        ];
        const elements = document.querySelectorAll(
          "main.rawaj-admin-v3 :is(section, article, button, input, textarea, select, [data-ui='card'], .rawaj-admin-card, .rawaj-admin-panel), .rawaj-admin-nav-shell, .rawaj-admin-access-notice",
        );
        return Array.from(elements)
          .flatMap((el) => {
            const node = el as HTMLElement;
            const style = getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            if (
              !rect.width ||
              !rect.height ||
              style.visibility === "hidden" ||
              style.display === "none"
            ) {
              return [];
            }
            const observed = [
              style.backgroundColor,
              style.backgroundImage,
              style.color,
              style.borderTopColor,
            ];
            const name =
              node.tagName.toLowerCase() + "." + Array.from(node.classList).slice(0, 2).join(".");
            return observed
              .filter((value) => retiredRgb.some((rgb) => value.includes(rgb)))
              .map((value) => ({
                node: name,
                value: value.slice(0, 180),
              }));
          })
          .slice(0, 25);
      });
      expect(
        collisions,
        `${pathname} ${language} must contain no legacy chromatic admin surfaces`,
      ).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        pathname,
      ).toBeLessThanOrEqual(mobile ? 391 : 1441);
    }
  });
}
