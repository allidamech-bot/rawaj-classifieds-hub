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
  contrastFailures: string[];
  graphicalContrastFailures: string[];
  footerDockOverlap: boolean;
  activeNavigationIssues: string[];
}

export async function expectRenderedLayout(page: Page, options: LayoutAuditOptions) {
  await page.evaluate(() => document.fonts.ready);

  const report = await page.evaluate<LayoutAuditReport, { mobile: boolean }>(
    ({ mobile }) => {
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

      function parseColor(value: string) {
        const match = value.match(
          /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/,
        );
        if (!match) return null;
        return {
          r: Number(match[1]),
          g: Number(match[2]),
          b: Number(match[3]),
          a: match[4] === undefined ? 1 : Number(match[4]),
        };
      }

      function blend(
        foreground: { r: number; g: number; b: number; a: number },
        background: { r: number; g: number; b: number; a: number },
      ) {
        const alpha = foreground.a + background.a * (1 - foreground.a);
        if (alpha <= 0) return { r: 36, g: 37, b: 41, a: 1 };
        return {
          r:
            (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) /
            alpha,
          g:
            (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) /
            alpha,
          b:
            (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) /
            alpha,
          a: alpha,
        };
      }

      function effectiveBackground(element: Element) {
        const layers: Array<{ r: number; g: number; b: number; a: number }> = [];
        let current: Element | null = element;
        while (current) {
          const parsed = parseColor(window.getComputedStyle(current).backgroundColor);
          if (parsed && parsed.a > 0) layers.push(parsed);
          current = current.parentElement;
        }

        let result = { r: 36, g: 37, b: 41, a: 1 };
        for (const layer of layers.reverse()) result = blend(layer, result);
        return result;
      }

      function channel(value: number) {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      }

      function luminance(color: { r: number; g: number; b: number }) {
        return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
      }

      function contrastRatio(
        foreground: { r: number; g: number; b: number; a: number },
        background: { r: number; g: number; b: number; a: number },
      ) {
        const resolvedForeground = blend(foreground, background);
        const foregroundLuminance = luminance(resolvedForeground);
        const backgroundLuminance = luminance(background);
        const lighter = Math.max(foregroundLuminance, backgroundLuminance);
        const darker = Math.min(foregroundLuminance, backgroundLuminance);
        return (lighter + 0.05) / (darker + 0.05);
      }

      function directlyOwnsText(element: Element) {
        return Array.from(element.childNodes).some(
          (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
        );
      }

      function isDisabled(element: Element) {
        return (
          element.hasAttribute("disabled") ||
          element.getAttribute("aria-disabled") === "true" ||
          Boolean(element.closest("[disabled], [aria-disabled='true']"))
        );
      }

      const unnamedActions = Array.from(document.querySelectorAll("button, a[href]"))
        .filter(visible)
        .filter((element) => !actionName(element))
        .map(describe)
        .slice(0, 20);

      const unlabeledFields = Array.from(
        document.querySelectorAll(
          "input:not([type='hidden']):not([type='button']):not([type='submit']), select, textarea",
        ),
      )
        .filter(visible)
        .filter((element) => !fieldLabel(element))
        .map(describe)
        .slice(0, 20);

      const undersizedButtons = mobile
        ? Array.from(document.querySelectorAll("button"))
            .filter(visible)
            .filter((element) => element.getBoundingClientRect().height < 40)
            .map(describe)
            .slice(0, 20)
        : [];

      const contrastFailures = Array.from(
        document.querySelectorAll(
          "h1, h2, h3, h4, h5, h6, p, span, strong, small, label, a, button, li, td, th, legend",
        ),
      )
        .filter(visible)
        .filter(directlyOwnsText)
        .filter((element) => !isDisabled(element))
        .flatMap((element) => {
          const style = window.getComputedStyle(element);
          if (Number(style.opacity) < 0.5 || style.visibility === "hidden") return [];
          const foreground = parseColor(style.color);
          if (!foreground) return [];
          const background = effectiveBackground(element);
          const ratio = contrastRatio(foreground, background);
          const fontSize = Number.parseFloat(style.fontSize);
          const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
          const largeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
          const required = largeText ? 3 : 4.5;
          return ratio + 0.01 < required
            ? [`${describe(element)} [${ratio.toFixed(2)}:1 < ${required}:1]`]
            : [];
        })
        .slice(0, 30);

      const graphicalContrastFailures = Array.from(
        document.querySelectorAll("button svg, a[href] svg, [role='button'] svg"),
      )
        .filter(visible)
        .filter((element) => !isDisabled(element))
        .flatMap((element) => {
          const foreground = parseColor(window.getComputedStyle(element).color);
          if (!foreground) return [];
          const background = effectiveBackground(element);
          const ratio = contrastRatio(foreground, background);
          return ratio + 0.01 < 3 ? [`${describe(element)} [${ratio.toFixed(2)}:1 < 3:1]`] : [];
        })
        .slice(0, 20);

      const footer = document.querySelector(".rawaj-site-footer");
      const dock = document.querySelector(".rawaj-mobile-dock");
      let footerDockOverlap = false;
      if (footer && dock && visible(footer) && visible(dock)) {
        const footerBottomAtMaxScroll =
          footer.getBoundingClientRect().bottom +
          window.scrollY -
          Math.max(0, root.scrollHeight - window.innerHeight);
        footerDockOverlap = footerBottomAtMaxScroll > dock.getBoundingClientRect().top + 1;
      }

      function expectedSection(pathname: string) {
        if (pathname === "/") return "home";
        if (
          pathname === "/categories" ||
          pathname.startsWith("/categories/") ||
          pathname.startsWith("/category/") ||
          pathname === "/listings" ||
          pathname.startsWith("/listings/") ||
          pathname.startsWith("/seller/")
        ) {
          return "categories";
        }
        if (pathname === "/add-listing" || pathname.startsWith("/add-listing/"))
          return "addListing";
        if (pathname === "/chats" || pathname.startsWith("/chats/")) return "chats";
        if (pathname === "/offers" || pathname.startsWith("/promotion")) return "offers";
        if (
          [
            "/more",
            "/profile",
            "/activity",
            "/notifications",
            "/verification",
            "/saved-searches",
            "/favorites",
            "/support",
            "/safety",
            "/privacy",
            "/terms",
            "/prohibited",
          ].some((path) => pathname === path || pathname.startsWith(`${path}/`))
        ) {
          return "account";
        }
        return "none";
      }

      const activeNavigationIssues: string[] = [];
      const section = expectedSection(window.location.pathname);
      for (const navigation of Array.from(
        document.querySelectorAll(
          "nav[aria-label='التنقل الرئيسي'], nav[aria-label='Primary navigation']",
        ),
      ).filter(visible)) {
        const availableSections = Array.from(navigation.querySelectorAll("[data-section]"))
          .map((item) => item.getAttribute("data-section"))
          .filter(Boolean);
        const expectsActive =
          section !== "none" &&
          (availableSections.length === 0
            ? ["home", "categories", "offers"].includes(section)
            : availableSections.includes(section));
        if (!expectsActive) continue;
        const activeItems = navigation.querySelectorAll('[aria-current="page"]');
        if (activeItems.length !== 1) {
          activeNavigationIssues.push(
            `${navigation.className || "primary navigation"} expected one active ${section} item, found ${activeItems.length}`,
          );
        }
      }

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
        contrastFailures,
        graphicalContrastFailures,
        footerDockOverlap,
        activeNavigationIssues,
      };
    },
    { mobile: options.mobile },
  );

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
  expect(report.unnamedActions, `${options.label}: visible actions need accessible names`).toEqual(
    [],
  );
  expect(report.unlabeledFields, `${options.label}: visible form fields need labels`).toEqual([]);
  expect(report.undersizedButtons, `${options.label}: mobile buttons must remain tappable`).toEqual(
    [],
  );
  expect(report.contrastFailures, `${options.label}: visible text must meet WCAG contrast`).toEqual(
    [],
  );
  expect(
    report.graphicalContrastFailures,
    `${options.label}: essential control graphics must meet WCAG contrast`,
  ).toEqual([]);
  expect(report.footerDockOverlap, `${options.label}: footer must clear the mobile dock`).toBe(
    false,
  );
  expect(
    report.activeNavigationIssues,
    `${options.label}: visible primary navigation needs one active state`,
  ).toEqual([]);
}
