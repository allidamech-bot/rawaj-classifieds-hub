import { expect, type Page } from "@playwright/test";

interface LayoutAuditOptions {
  label: string;
  mobile: boolean;
}

interface LayoutAuditReport {
  viewportWidth: number;
  documentWidth: number;
  bodyWidth: number;
  direction: string;
  language: string;
  mainVisible: boolean;
  unnamedActions: string[];
  unlabeledFields: string[];
  undersizedButtons: string[];
}

export async function expectRenderedLayout(page: Page, options: LayoutAuditOptions) {
  await page.evaluate(() => document.fonts.ready);

  const report = await page.evaluate<LayoutAuditReport, { mobile: boolean }>(({ mobile }) => {
    const root = document.documentElement;
    const body = document.body;
    const viewportWidth = window.innerWidth;

    function visible(element: Element): element is HTMLElement {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0 ||
        element.hidden
      ) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function describe(element: Element) {
      const htmlElement = element as HTMLElement;
      const text = htmlElement.innerText?.trim().replace(/\s+/g, " ").slice(0, 80);
      const id = htmlElement.id ? `#${htmlElement.id}` : "";
      const className =
        typeof htmlElement.className === "string"
          ? htmlElement.className
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 3)
              .map((value) => `.${value}`)
              .join("")
          : "";
      return `${element.tagName.toLowerCase()}${id}${className}${text ? ` (${text})` : ""}`;
    }

    function referencedText(element: Element, attribute: "aria-labelledby" | "aria-describedby") {
      const ids = element.getAttribute(attribute)?.trim().split(/\s+/).filter(Boolean) ?? [];
      return ids
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" ");
    }

    function actionName(element: Element) {
      return (
        element.getAttribute("aria-label")?.trim() ||
        referencedText(element, "aria-labelledby") ||
        element.getAttribute("title")?.trim() ||
        element.textContent?.trim() ||
        element.querySelector("img")?.getAttribute("alt")?.trim() ||
        ""
      );
    }

    function fieldLabel(element: Element) {
      const id = element.getAttribute("id");
      const explicit = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      const wrapped = element.closest("label");
      return (
        element.getAttribute("aria-label")?.trim() ||
        referencedText(element, "aria-labelledby") ||
        explicit?.textContent?.trim() ||
        wrapped?.textContent?.trim() ||
        ""
      );
    }

    const unnamedActions = Array.from(document.querySelectorAll("button, a[href]"))
      .filter(visible)
      .filter((element) => !actionName(element))
      .map(describe)
      .slice(0, 20);

    const unlabeledFields = Array.from(
      document.querySelectorAll("input:not([type='hidden']):not([type='button']):not([type='submit']), select, textarea"),
    )
      .filter(visible)
      .filter((element) => !fieldLabel(element))
      .map(describe)
      .slice(0, 20);

    const undersizedButtons = mobile
      ? Array.from(document.querySelectorAll("button"))
          .filter(visible)
          .filter((element) => element.getBoundingClientRect().height < 31.5)
          .map(describe)
          .slice(0, 20)
      : [];

    const main = document.querySelector("main");
    const mainVisible = Boolean(main && visible(main));

    return {
      viewportWidth,
      documentWidth: root.scrollWidth,
      bodyWidth: body?.scrollWidth ?? root.scrollWidth,
      direction: root.dir,
      language: root.lang,
      mainVisible,
      unnamedActions,
      unlabeledFields,
      undersizedButtons,
    };
  }, { mobile: options.mobile });

  expect(report.mainVisible, `${options.label}: main must be rendered`).toBe(true);
  expect(
    Math.max(report.documentWidth, report.bodyWidth),
    `${options.label}: document must not overflow horizontally`,
  ).toBeLessThanOrEqual(report.viewportWidth + 2);
  expect(["rtl", "ltr"], `${options.label}: root direction must be explicit`).toContain(
    report.direction,
  );
  expect(["ar", "en"], `${options.label}: root language must be explicit`).toContain(
    report.language,
  );
  expect(report.unnamedActions, `${options.label}: visible actions need accessible names`).toEqual([]);
  expect(report.unlabeledFields, `${options.label}: visible form fields need labels`).toEqual([]);
  expect(report.undersizedButtons, `${options.label}: mobile buttons must remain tappable`).toEqual([]);
}
