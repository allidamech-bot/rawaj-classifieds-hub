const LISTING_STUDIO_SELECTOR = ".rawaj-listing-studio-v4";
const ACTION_BAR_SELECTOR = ".rawaj-studio-action-bar";

function normalizeLabel(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isBackButton(button: HTMLButtonElement) {
  const label = normalizeLabel(button.textContent);
  return label === "السابق" || label === "back";
}

function currentStepIndex(studio: Element) {
  const items = Array.from(studio.querySelectorAll<HTMLElement>(".rawaj-studio-steps > li"));
  return items.findIndex((item) => item.getAttribute("aria-current") === "step");
}

function moveToPreviousStep(studio: Element) {
  const index = currentStepIndex(studio);
  if (index <= 0) return false;

  const previousStep = studio.querySelectorAll<HTMLButtonElement>(
    ".rawaj-studio-steps > li > button",
  )[index - 1];
  if (!previousStep || previousStep.disabled) return false;

  previousStep.click();
  window.requestAnimationFrame(() => {
    studio.querySelector<HTMLElement>(".rawaj-studio-steps")?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  });
  return true;
}

function normalizeActionButtonTypes(root: ParentNode = document) {
  root
    .querySelectorAll<HTMLButtonElement>(
      `${LISTING_STUDIO_SELECTOR} ${ACTION_BAR_SELECTOR} button:not([type])`,
    )
    .forEach((button) => {
      button.type = "button";
    });
}

function handleListingStudioClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const button = target.closest<HTMLButtonElement>(`${ACTION_BAR_SELECTOR} button`);
  if (!button || !isBackButton(button)) return;

  const studio = button.closest(LISTING_STUDIO_SELECTOR);
  if (!studio || button.disabled) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  moveToPreviousStep(studio);
}

if (typeof document !== "undefined") {
  normalizeActionButtonTypes();
  document.addEventListener("click", handleListingStudioClick, true);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) normalizeActionButtonTypes(node);
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
