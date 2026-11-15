import { expect, test } from "@playwright/test";

const routes = [
  { path: "/activity", selector: "main.rawaj-account-activity-v3" },
  { path: "/notifications", selector: "main.rawaj-communication-v2" },
  { path: "/chats", selector: "main.rawaj-communication-v2" },
] as const;

for (const { path, selector } of routes) {
  for (const language of ["ar", "en"] as const) {
    test(`B3.2 ${path} ${language}: readable at mobile and desktop sizes`, async ({
      page,
    }, testInfo) => {
      await page.addInitScript((value) => localStorage.setItem("rawaj-language", value), language);
      for (const width of [320, 360, 390, 430, 768, 1440]) {
        await page.setViewportSize({ width, height: 850 });
        const response = await page.goto(path, { waitUntil: "domcontentloaded" });
        expect(response?.status() ?? 200).toBeLessThan(500);
        await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
        await expect(page.locator("html")).toHaveAttribute(
          "dir",
          language === "ar" ? "rtl" : "ltr",
        );
        await expect(page.locator(selector)).toBeVisible();
        await page.evaluate(() => document.fonts.ready);

        const dimensions = await page.evaluate(() => ({
          body: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
        }));
        expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);

        const shell = page.locator(".rawaj-app-shell");
        await expect(shell).toHaveAttribute("data-resolved-pathname", path);
        if (width === 390) {
          const signInPanel = page.locator(".rawaj-communication-signed-out");
          await expect(signInPanel).toBeVisible();
          expect(
            await signInPanel.evaluate((node) => getComputedStyle(node, "::after").content),
          ).toBe("none");
          if (path === "/chats") {
            await expect(shell).toHaveCSS("background-color", "rgb(247, 243, 236)");
            await expect(page.locator(selector)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
          }

          const screenshot = testInfo.outputPath(
            `b3-communication-${path.slice(1)}-${language}.png`,
          );
          await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
          await testInfo.attach(`b3-${path}-${language}`, {
            path: screenshot,
            contentType: "image/png",
          });
        }
      }
    });
  }
}

test("B3.2 chats preserves list-first mobile layout and keyboard access", async ({ page }) => {
  test.skip(process.env.RAWAJ_E2E_USE_FIXTURES !== "1", "Requires local account fixtures");
  await page.addInitScript(() => {
    localStorage.setItem(
      "rawaj:e2e:firebase-user",
      JSON.stringify({ email: "browser-smoke@rawa-j.test" }),
    );
  });
  await page.setViewportSize({ width: 390, height: 780 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/chats", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");

  const workspace = page.locator(".rawaj-message-workspace");
  await expect(workspace).toBeVisible();
  await expect(workspace).toHaveAttribute("data-view", "list");
  await expect(workspace.locator(".rawaj-message-panel")).toBeHidden();

  const firstControl = workspace.locator(":is(a, button, input):visible").first();
  await expect(firstControl).toBeVisible();
  await firstControl.focus();
  await expect(firstControl).toBeFocused();
});
