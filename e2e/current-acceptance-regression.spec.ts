import { expect, test } from "@playwright/test";

async function waitForHydration(page: import("@playwright/test").Page) {
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
}

test("categories direct load keeps its designed atlas and active production ad together", async ({
  page,
}) => {
  const response = await page.goto("/categories", { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 200).toBeLessThan(500);
  await waitForHydration(page);

  const placement = page.locator('[data-placement-page="categories"]');
  await expect(placement).toBeVisible({ timeout: 15_000 });
  await expect(placement).toHaveAttribute("data-placement-loading", "false", {
    timeout: 15_000,
  });

  const image = placement.locator("img.rawaj-ad-placement__image");
  await expect(image).toHaveCount(1);
  await expect
    .poll(() =>
      image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
    )
    .toBe(true);

  const categoryVisuals = await page.evaluate(() => {
    const heading = document.querySelector<HTMLElement>("[data-category-directory-heading]");
    const grid = document.querySelector<HTMLElement>("[data-category-directory-grid]");
    const link = document.querySelector<HTMLElement>("[data-category-directory-link]");
    const icon = link?.querySelector<HTMLElement>("[data-category-directory-icon]");
    if (!heading || !grid || !link || !icon) return null;
    const headingStyle = getComputedStyle(heading);
    const gridStyle = getComputedStyle(grid);
    const linkStyle = getComputedStyle(link);
    return {
      headingBackground: headingStyle.backgroundImage,
      gridDisplay: gridStyle.display,
      linkBackground: linkStyle.backgroundColor,
      linkImage: linkStyle.backgroundImage,
      linkBorder: linkStyle.borderStyle,
      iconBackground: getComputedStyle(icon).backgroundColor,
    };
  });

  expect(categoryVisuals).not.toBeNull();
  expect(categoryVisuals?.headingBackground).toBe("none");
  expect(categoryVisuals?.gridDisplay).toBe("grid");
  expect(categoryVisuals?.linkBackground).toBe("rgb(255, 255, 255)");
  expect(categoryVisuals?.linkImage).toBe("none");
  expect(categoryVisuals?.linkBorder).toBe("solid");
  expect(categoryVisuals?.iconBackground).not.toBe("rgba(0, 0, 0, 0)");
});

test("mobile chat workspace state overrides stale or transient panel classes", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile messaging contract");

  const response = await page.goto("/chats", { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 200).toBeLessThan(500);
  await waitForHydration(page);

  const listState = await page.evaluate(() => {
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
      workspaceHeight: workspace.getBoundingClientRect().height,
    };
    workspace.remove();
    return result;
  });

  expect(listState.sidebar).not.toBe("none");
  expect(listState.panel).toBe("none");
  expect(listState.workspaceHeight).toBeLessThan(200);

  const staleSelectedState = await page.evaluate(() => {
    const workspace = document.createElement("div");
    workspace.className = "rawaj-message-workspace";
    workspace.dataset.view = "conversation";

    const sidebar = document.createElement("aside");
    sidebar.className = "rawaj-conversation-sidebar";
    const panel = document.createElement("section");
    panel.className = "rawaj-message-panel hidden";
    workspace.append(sidebar, panel);
    document.body.append(workspace);

    const result = {
      panel: getComputedStyle(panel).display,
      panelHeight: panel.getBoundingClientRect().height,
    };
    workspace.remove();
    return result;
  });

  expect(staleSelectedState.panel).toBe("none");
  expect(staleSelectedState.panelHeight).toBe(0);

  const conversationState = await page.evaluate(() => {
    const workspace = document.createElement("div");
    workspace.className = "rawaj-message-workspace";
    workspace.dataset.view = "conversation";

    const sidebar = document.createElement("aside");
    sidebar.className = "rawaj-conversation-sidebar";
    const panel = document.createElement("section");
    panel.className = "rawaj-message-panel";
    workspace.append(sidebar, panel);
    document.body.append(workspace);

    const result = {
      sidebar: getComputedStyle(sidebar).display,
      panel: getComputedStyle(panel).display,
    };
    workspace.remove();
    return result;
  });

  expect(conversationState.sidebar).toBe("none");
  expect(conversationState.panel).toBe("flex");
});
