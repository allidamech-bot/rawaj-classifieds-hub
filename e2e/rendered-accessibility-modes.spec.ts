import { expect, test } from "@playwright/test";

import { expectRenderedLayout } from "./layout-audit";

test.use({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});

for (const route of [
  { name: "home", path: "/" },
  { name: "account", path: "/more" },
  { name: "login", path: "/login" },
] as const) {
  test(`${route.name} tolerates 200% text scaling with reduced motion`, async ({ page }, testInfo) => {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await expect(page.locator('html[data-rawaj-a11y-ready="true"]')).toHaveCount(1);
    await page.addStyleTag({
      content: `
        html { font-size: 200% !important; }
        aside[data-placement-loading="true"] { display: none !important; }
      `,
    });

    await expectRenderedLayout(page, {
      label: `text-200:${route.name}`,
      mobile: true,
    });

    await page.screenshot({
      path: testInfo.outputPath(`${route.name}-text-200-reduced-motion-390x844.png`),
      fullPage: true,
      animations: "disabled",
    });
  });
}
