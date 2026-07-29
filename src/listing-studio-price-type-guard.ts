const STUDIO_SELECTOR = ".rawaj-listing-studio-v4";
const NON_NUMERIC_PRICE_TYPES = new Set(["contact", "free", "exchange"]);

function findPriceControls(studio: Element) {
  const priceType = Array.from(studio.querySelectorAll<HTMLSelectElement>("select")).find(
    (select) =>
      ["fixed", "negotiable", "contact", "free", "exchange"].every((value) =>
        Array.from(select.options).some((option) => option.value === value),
      ),
  );
  if (!priceType) return null;

  const priceInput = Array.from(
    studio.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]'),
  ).find((input) => !input.disabled || input.dataset.rawajPriceInput === "true");
  if (!priceInput) return null;
  priceInput.dataset.rawajPriceInput = "true";
  return { priceType, priceInput };
}

function syncPriceControls(studio: Element) {
  const controls = findPriceControls(studio);
  if (!controls) return;

  const disabled = NON_NUMERIC_PRICE_TYPES.has(controls.priceType.value);
  controls.priceInput.disabled = disabled;
  controls.priceInput.setAttribute("aria-disabled", String(disabled));

  if (disabled && controls.priceInput.value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(controls.priceInput, "");
    controls.priceInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function handlePriceTypeChange(event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  const studio = target.closest(STUDIO_SELECTOR);
  if (!studio) return;
  syncPriceControls(studio);
}

if (typeof document !== "undefined") {
  document.addEventListener("change", handlePriceTypeChange, true);
  const observer = new MutationObserver(() => {
    document.querySelectorAll(STUDIO_SELECTOR).forEach(syncPriceControls);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
