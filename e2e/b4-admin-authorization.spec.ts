import { expect, test, type Page } from "@playwright/test";

// TanStack generated route inventory, main @ f066793becf75c4e47479a88bee0264635f62932.
// Keep this list explicit: new admin routes must be reviewed rather than silently inherited.
const adminRoutes = [
  "/admin",
  "/admin/ad-placements",
  "/admin/audit",
  "/admin/campaigns",
  "/admin/data-quality",
  "/admin/listings",
  "/admin/message-reports",
  "/admin/notifications",
  "/admin/owner-controls",
  "/admin/pending",
  "/admin/promotions",
  "/admin/reports",
  "/admin/reviews",
  "/admin/safety",
  "/admin/users",
  "/admin/verifications",
] as const;

async function ready(page: Page, language: "ar" | "en") {
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
  await expect(page.locator("html")).toHaveAttribute("dir", language === "ar" ? "rtl" : "ltr");
}

test.describe("B4 admin route and authorization acceptance (isolated fixtures only)", () => {
  test.beforeEach(() => {
    test.skip(
      process.env.RAWAJ_E2E_USE_FIXTURES !== "1" || Boolean(process.env.E2E_BASE_URL),
      "Never exercise privileged or private route probes against production",
    );
  });

  for (const language of ["ar", "en"] as const) {
    test("all sixteen admin routes deny anonymous access: " + language, async ({ page }) => {
      await page.addInitScript((value) => {
        localStorage.removeItem("rawaj:e2e:firebase-user");
        localStorage.setItem("rawaj-language", value);
      }, language);

      const privilegedRequests: string[] = [];
      page.on("request", (request) => {
        const path = new URL(request.url()).pathname;
        if (/^\/(?:api|v1)\/admin(?:\/|$)/.test(path)) {
          privilegedRequests.push(request.method() + " " + path);
        }
      });

      for (const path of adminRoutes) {
        const response = await page.goto(path, { waitUntil: "domcontentloaded" });
        expect(response?.status() ?? 200, "route " + path).toBeLessThan(500);
        await ready(page, language);
        await expect(page.getByRole("heading", {
          name: /تسجيل الدخول مطلوب|Login required/,
        })).toBeVisible();
        await expect(page.locator(".rawaj-admin-nav-rail")).toHaveCount(0);
        await expect(page.locator('.rawaj-admin-v3 a[href="/login"]')).toBeVisible();
        await expect(page.locator('a[href="/admin/owner-controls"]')).toHaveCount(0);
      }

      expect(privilegedRequests, "Signed-out visitors must never load administrative data").toEqual([]);
    });

    test("authenticated ordinary member is denied privileged admin workspaces: " + language, async ({
      page,
    }) => {
      await page.addInitScript((value) => {
        localStorage.setItem("rawaj-language", value);
        localStorage.setItem("rawaj:e2e:firebase-user", "{}");
      }, language);

      const privilegedRequests: string[] = [];
      page.on("request", (request) => {
        const path = new URL(request.url()).pathname;
        if (/^\/(?:api|v1)\/admin(?:\/|$)/.test(path)) {
          privilegedRequests.push(request.method() + " " + path);
        }
      });

      for (const path of ["/admin", "/admin/users", "/admin/owner-controls"]) {
        const response = await page.goto(path, { waitUntil: "domcontentloaded" });
        expect(response?.status() ?? 200).toBeLessThan(500);
        await ready(page, language);
        await expect(page.getByRole("heading", {
          name: /غير مخوّل|Not authorized/,
        })).toBeVisible();
        await expect(page.locator(".rawaj-admin-nav-rail")).toHaveCount(0);
      }
      expect(privilegedRequests, "A normal user must not initiate privileged requests").toEqual([]);
    });
  }
});
