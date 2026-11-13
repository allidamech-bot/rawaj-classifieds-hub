import { expect, test } from "@playwright/test";

async function waitForHydration(page: import("@playwright/test").Page) {
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
}

test("categories route loads its designed atlas instead of utility-only rows", async ({ page }) => {
  const response = await page.goto("/categories", { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 200).toBeLessThan(500);
  await waitForHydration(page);

  const hero = page.locator("[data-category-directory-heading]");
  const grid = page.locator("[data-category-directory-grid]");
  const firstCard = page.locator("[data-category-directory-card]").first();

  await expect(hero).toBeVisible();
  await expect(grid).toBeVisible();
  await expect(firstCard).toBeVisible();

  const visualContract = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>("[data-category-directory-heading]");
    const grid = document.querySelector<HTMLElement>("[data-category-directory-grid]");
    const card = document.querySelector<HTMLElement>("[data-category-directory-link]");
    const icon = card?.querySelector<HTMLElement>("[data-category-directory-icon]");

    if (!hero || !grid || !card || !icon) return null;

    const heroStyle = getComputedStyle(hero);
    const gridStyle = getComputedStyle(grid);
    const cardStyle = getComputedStyle(card);
    const iconStyle = getComputedStyle(icon);

    return {
      heroBackground: heroStyle.backgroundImage,
      gridDisplay: gridStyle.display,
      gridColumns: gridStyle.gridTemplateColumns,
      cardBackground: cardStyle.backgroundImage,
      cardColor: cardStyle.backgroundColor,
      cardBorderStyle: cardStyle.borderStyle,
      iconBackground: iconStyle.backgroundColor,
    };
  });

  expect(visualContract).not.toBeNull();
  expect(visualContract?.heroBackground).toBe("none");
  expect(visualContract?.gridDisplay).toBe("grid");
  expect(visualContract?.gridColumns).not.toBe("none");
  expect(visualContract?.cardBackground).toBe("none");
  expect(visualContract?.cardColor).toBe("rgb(255, 255, 255)");
  expect(visualContract?.cardBorderStyle).toBe("solid");
  expect(visualContract?.iconBackground).not.toBe("rgba(0, 0, 0, 0)");
});

test("categories atlas stays readable at narrow mobile widths", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile-only category density check");

  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 820 });
    await page.goto("/categories", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    const metrics = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      cardCount: document.querySelectorAll("[data-category-directory-card]").length,
      firstCardHeight:
        document
          .querySelector<HTMLElement>("[data-category-directory-card]")
          ?.getBoundingClientRect().height ?? 0,
    }));

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.cardCount).toBeGreaterThan(0);
    expect(metrics.firstCardHeight).toBeGreaterThan(64);
  }
});
