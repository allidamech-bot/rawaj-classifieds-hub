import { expect, test } from "@playwright/test";

test.describe("home notification overlay boundary", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the home header does not clip overlays opened below it", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 200).toBeLessThan(500);

    const header = page.locator(
      '.rawaj-app-shell[data-resolved-pathname="/"] .rawaj-app-header',
    );
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
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return hit === element || element.contains(hit);
      }),
    ).toBe(true);
  });
});
