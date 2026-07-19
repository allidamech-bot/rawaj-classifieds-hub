import { expect, test } from "@playwright/test";

async function waitForHydration(page: import("@playwright/test").Page) {
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
}

test("categories direct load renders the active production ad placement", async ({ page }) => {
  const response = await page.goto("/categories", { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 200).toBeLessThan(500);
  await waitForHydration(page);

  const placement = page.locator('[data-placement-page="categories"]');
  await expect(placement).toBeVisible({ timeout: 15_000 });
  await expect(placement).toHaveAttribute("data-placement-loading", "false", {
    timeout: 15_000,
  });

  const image = placement.locator("img");
  await expect(image).toHaveCount(1);
  await expect
    .poll(() =>
      image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
    )
    .toBe(true);
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

    // Reproduce the reported regression: neither element has Tailwind's `hidden`
    // class while auth/search state is changing. Workspace state must still win.
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

  const conversationState = await page.evaluate(() => {
    const workspace = document.createElement("div");
    workspace.className = "rawaj-message-workspace";
    workspace.dataset.view = "conversation";

    // Conversation mode must also be deterministic without relying on `hidden`.
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
