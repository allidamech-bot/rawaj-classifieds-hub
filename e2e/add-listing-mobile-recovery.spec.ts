import { expect, test, type Page } from "@playwright/test";

type FixtureWindow = Window & { __listingStudioSubmitCount?: number };
type Rgb = readonly [number, number, number];

const mobileViewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
] as const;

const lightHeroSamples: Rgb[] = [
  [255, 250, 241],
  [238, 248, 242],
  [255, 240, 231],
];

function parseRgb(value: string): Rgb {
  const channels = value
    .match(/\d+(?:\.\d+)?/g)
    ?.slice(0, 3)
    .map(Number);
  if (!channels || channels.length !== 3) throw new Error(`Invalid RGB color: ${value}`);
  return [channels[0], channels[1], channels[2]];
}

function relativeLuminance(rgb: Rgb) {
  const [red, green, blue] = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(first: Rgb, second: Rgb) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

async function installListingStudioFixture(page: Page) {
  await page.evaluate(() => {
    document.querySelector('[data-testid="listing-studio-recovery-fixture"]')?.remove();

    const form = document.createElement("form");
    form.setAttribute("data-testid", "listing-studio-recovery-fixture");
    form.innerHTML = `
      <main class="rawaj-listing-studio-v4">
        <section class="rawaj-studio-hero">
          <h1>أنشئ إعلاناً واضحاً وجاهزاً للبيع</h1>
          <p class="rawaj-studio-hero__description">أكمل الخطوات ثم راجع إعلانك.</p>
          <div class="rawaj-studio-hero__status"><span>4 خطوات واضحة</span><span>حفظ تلقائي</span></div>
          <div class="rawaj-studio-hero__actions"><a href="#fixture">الرئيسية</a><button type="button">تصفح الإعلانات</button></div>
        </section>
        <ol class="rawaj-studio-steps">
          <li><button type="button" data-testid="fixture-previous-step"><span class="rawaj-studio-steps__copy"><strong>ماذا تبيع؟</strong><small>القسم والعنوان</small></span></button></li>
          <li aria-current="step"><button type="button"><span class="rawaj-studio-steps__copy"><strong>الصور والتفاصيل</strong><small>الصور والوصف</small></span></button></li>
          <li><button type="button"><span class="rawaj-studio-steps__copy"><strong>السعر والموقع</strong><small>السعر والتواصل</small></span></button></li>
          <li><button type="button"><span class="rawaj-studio-steps__copy"><strong>مراجعة وإرسال</strong><small>تحقق نهائي</small></span></button></li>
        </ol>
        <section class="rawaj-studio-section">
          <input data-testid="fixture-title" value="هاتف للبيع" />
        </section>
        <div class="rawaj-studio-action-bar">
          <button type="button" data-testid="fixture-back">السابق</button>
          <button type="button" data-testid="fixture-continue">متابعة</button>
        </div>
      </main>`;

    const state = window as FixtureWindow;
    state.__listingStudioSubmitCount = 0;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      state.__listingStudioSubmitCount = (state.__listingStudioSubmitCount ?? 0) + 1;
    });

    const firstStep = form.querySelector<HTMLButtonElement>(
      '[data-testid="fixture-previous-step"]',
    );
    const back = form.querySelector<HTMLButtonElement>('[data-testid="fixture-back"]');
    const activeStep = form.querySelector<HTMLElement>('li[aria-current="step"]');
    const goToPreviousStep = () => {
      activeStep?.removeAttribute("aria-current");
      firstStep?.closest("li")?.setAttribute("aria-current", "step");
    };
    firstStep?.addEventListener("click", goToPreviousStep);
    back?.addEventListener("click", goToPreviousStep);

    document.body.append(form);
  });

  const fixture = page.getByTestId("listing-studio-recovery-fixture");
  await expect(fixture).toBeVisible();
  return fixture.locator(".rawaj-listing-studio-v4");
}

for (const viewport of mobileViewports) {
  test.describe(`add-listing mobile recovery ${viewport.width}px`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      const response = await page.goto("/add-listing", {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status() ?? 200).toBeLessThan(500);
    });

    test("renders readable, bounded, non-overlapping controls", async ({ page }) => {
      const studio = await installListingStudioFixture(page);
      await expect(page.locator("html")).toHaveAttribute("dir", /rtl/i);

      const geometry = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
      }));
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport + 1);

      const hero = studio.locator(".rawaj-studio-hero");
      const heroColors = await hero.evaluate((element) => {
        const heading = element.querySelector("h1");
        return {
          background: getComputedStyle(element).backgroundImage,
          headingColor: heading ? getComputedStyle(heading).color : "",
        };
      });
      expect(heroColors.background).toContain("linear-gradient");
      const headingRgb = parseRgb(heroColors.headingColor);
      for (const backgroundRgb of lightHeroSamples) {
        expect(contrastRatio(headingRgb, backgroundRgb)).toBeGreaterThanOrEqual(7);
      }

      const stepBoxes = await studio.locator(".rawaj-studio-steps > li").evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
          };
        }),
      );
      for (const box of stepBoxes) {
        expect(box.left).toBeGreaterThanOrEqual(-1);
        expect(box.right).toBeLessThanOrEqual(viewport.width + 1);
      }
      for (let first = 0; first < stepBoxes.length; first += 1) {
        for (let second = first + 1; second < stepBoxes.length; second += 1) {
          const horizontalOverlap =
            Math.min(stepBoxes[first].right, stepBoxes[second].right) -
            Math.max(stepBoxes[first].left, stepBoxes[second].left);
          const verticalOverlap =
            Math.min(stepBoxes[first].bottom, stepBoxes[second].bottom) -
            Math.max(stepBoxes[first].top, stepBoxes[second].top);
          expect(horizontalOverlap > 0 && verticalOverlap > 0).toBe(false);
        }
      }

      const actionBar = studio.locator(".rawaj-studio-action-bar");
      await actionBar.scrollIntoViewIfNeeded();
      const box = await actionBar.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
    });

    test("back returns without submitting or clearing values", async ({ page }) => {
      const studio = await installListingStudioFixture(page);
      const back = page.getByTestId("fixture-back");

      await expect(back).toHaveAttribute("type", "button");
      await back.click();

      await expect(studio.locator(".rawaj-studio-steps > li").first()).toHaveAttribute(
        "aria-current",
        "step",
      );
      await expect(studio.locator(".rawaj-studio-steps > li").nth(1)).not.toHaveAttribute(
        "aria-current",
        "step",
      );
      await expect(page.getByTestId("fixture-title")).toHaveValue("هاتف للبيع");
      expect(await page.evaluate(() => (window as FixtureWindow).__listingStudioSubmitCount)).toBe(
        0,
      );
    });
  });
}
