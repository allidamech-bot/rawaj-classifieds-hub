import { expect, test } from "@playwright/test";

test.describe("home notification overlay boundary", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the home header does not clip overlays opened below it", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 200).toBeLessThan(500);

    const header = page.locator('.rawaj-app-shell[data-resolved-pathname="/"] .rawaj-app-header');
    await expect(header).toBeVisible();

    await expect
      .poll(() => header.evaluate((element) => getComputedStyle(element).overflow))
      .toBe("visible");

    const headerShell = header.locator(".rawaj-floating-header-shell");
    await headerShell.evaluate((element) => {
      const probe = document.createElement("div");
      probe.dataset.notificationOverlayProbe = "true";
      probe.textContent = "notification overlay probe";
      Object.assign(probe.style, {
        position: "absolute",
        insetInlineEnd: "0.75rem",
        top: "calc(100% + 0.5rem)",
        width: "12rem",
        height: "3rem",
        zIndex: "100",
        background: "rgb(255, 0, 0)",
      });
      element.appendChild(probe);
    });

    const probe = page.locator('[data-notification-overlay-probe="true"]');
    await expect(probe).toBeVisible();
    expect(
      await probe.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return hit === element || element.contains(hit);
      }),
    ).toBe(true);
  });
});

for (const language of ["ar", "en"] as const) {
  test(`signed-in bell preview uses readable light colors in ${language}`, async ({ page }) => {
    test.skip(process.env.RAWAJ_E2E_USE_FIXTURES !== "1", "Requires local Firebase fixtures");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((locale) => {
      localStorage.setItem("rawaj-language", locale);
      localStorage.setItem("rawaj:e2e:firebase-user", "{}");
    }, language);
    const item = {
      type: "account.updated",
      titleAr: "تحديث الحساب",
      titleEn: "Account update",
      bodyAr: "يمكنك مراجعة إعدادات حسابك.",
      bodyEn: "You can review your account settings.",
      targetType: null,
      targetId: null,
      createdAt: "2026-07-30T13:00:00.000Z",
    };
    await page.route(/\/v1\/account\/notifications(?:\?|$)/, (route) =>
      route.fulfill({
        json: {
          data: {
            items: [
              { ...item, id: "00000000-0000-4000-8000-000000000055", readAt: null },
              { ...item, id: "00000000-0000-4000-8000-000000000056", readAt: item.createdAt },
            ],
            nextCursor: null,
            hasMore: false,
          },
        },
      }),
    );

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("dir", language === "ar" ? "rtl" : "ltr");
    const label = language === "ar" ? "الإشعارات" : "Notifications";
    const bell = page
      .locator(".rawaj-app-header")
      .getByRole("button", { name: label, exact: true });
    await bell.click();

    const panel = page.getByRole("dialog", { name: label, exact: true });
    await expect(panel).toBeVisible();
    await expect.soft(panel).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect.soft(panel).toHaveCSS("background-image", "none");
    await expect
      .soft(panel.getByRole("heading", { name: label, exact: true }))
      .toHaveCSS("color", "rgb(21, 35, 34)");
    const unread = panel.locator('article[data-unread="true"]');
    await expect.soft(unread).toHaveCSS("background-color", "rgb(237, 244, 242)");
    await expect
      .soft(panel.locator('article[data-unread="false"]'))
      .toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect.soft(unread.getByRole("heading")).toHaveCSS("color", "rgb(21, 35, 34)");
    await expect
      .soft(unread.getByText(/يمكنك مراجعة|You can review/))
      .toHaveCSS("color", "rgb(83, 97, 94)");
    await expect
      .soft(panel.getByRole("button", { name: /فتح مركز الإشعارات|Open notification center/ }))
      .toHaveCSS("background-color", "rgb(16, 63, 66)");
  });
}
