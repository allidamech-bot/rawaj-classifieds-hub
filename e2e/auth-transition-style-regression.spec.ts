import { expect, test } from "@playwright/test";

async function waitForHydration(page: import("@playwright/test").Page) {
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
}

test("category atlas styles are already present while the login route is active", async ({ page }) => {
  const response = await page.goto("/login", { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 200).toBeLessThan(500);
  await waitForHydration(page);

  const state = await page.evaluate(() => {
    const root = document.createElement("div");
    root.className = "rawaj-categories-v2";
    const hero = document.createElement("section");
    hero.className = "rawaj-categories-v2__hero";
    const card = document.createElement("article");
    card.className = "rawaj-category-directory-card";
    root.append(hero, card);
    document.body.append(root);

    const result = {
      heroBackground: getComputedStyle(hero).backgroundImage,
      heroRadius: Number.parseFloat(getComputedStyle(hero).borderRadius),
      cardRadius: Number.parseFloat(getComputedStyle(card).borderRadius),
      cardBorderStyle: getComputedStyle(card).borderStyle,
    };
    root.remove();
    return result;
  });

  expect(state.heroBackground).toContain("linear-gradient");
  expect(state.heroRadius).toBeGreaterThan(16);
  expect(state.cardRadius).toBeGreaterThan(16);
  expect(state.cardBorderStyle).not.toBe("none");
});

test("mobile chat isolation styles are already present while the login route is active", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile-only chat layout contract");

  const response = await page.goto("/login", { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 200).toBeLessThan(500);
  await waitForHydration(page);

  const state = await page.evaluate(() => {
    const workspace = document.createElement("div");
    workspace.className = "rawaj-message-workspace";
    workspace.dataset.view = "list";
    const sidebar = document.createElement("aside");
    sidebar.className = "rawaj-conversation-sidebar";
    const panel = document.createElement("section");
    panel.className = "rawaj-message-panel";
    workspace.append(sidebar, panel);
    document.body.append(workspace);

    const result = {
      sidebar: getComputedStyle(sidebar).display,
      panel: getComputedStyle(panel).display,
      height: workspace.getBoundingClientRect().height,
    };
    workspace.remove();
    return result;
  });

  expect(state.sidebar).not.toBe("none");
  expect(state.panel).toBe("none");
  expect(state.height).toBeLessThan(200);
});
