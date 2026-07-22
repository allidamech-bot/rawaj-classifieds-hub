const LISTING_STUDIO_SELECTOR = ".rawaj-listing-studio-v4";
const ACTION_BAR_SELECTOR = ".rawaj-studio-action-bar";
const ACTION_BUTTON_SELECTOR = `${LISTING_STUDIO_SELECTOR} ${ACTION_BAR_SELECTOR} button`;
const boundBackButtons = new WeakSet<HTMLButtonElement>();

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

  window.setTimeout(() => {
    previousStep.click();
    window.requestAnimationFrame(() => {
      studio.querySelector<HTMLElement>(".rawaj-studio-steps")?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    });
  }, 0);
  return true;
}

function handleBackButtonClick(event: MouseEvent) {
  const button = event.currentTarget;
  if (!(button instanceof HTMLButtonElement) || button.disabled) return;

  const studio = button.closest(LISTING_STUDIO_SELECTOR);
  if (!studio) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  moveToPreviousStep(studio);
}

function bindActionButton(button: HTMLButtonElement) {
  button.type = "button";
  if (!isBackButton(button) || boundBackButtons.has(button)) return;

  boundBackButtons.add(button);
  button.dataset.listingStudioNavigationReady = "true";
  button.addEventListener("click", handleBackButtonClick, true);
}

function normalizeActionButtonTypes(root: ParentNode = document) {
  if (root instanceof HTMLButtonElement && root.matches(ACTION_BUTTON_SELECTOR)) {
    bindActionButton(root);
  }

  root.querySelectorAll<HTMLButtonElement>(ACTION_BUTTON_SELECTOR).forEach(bindActionButton);
}

if (typeof document !== "undefined") {
  normalizeActionButtonTypes();

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) normalizeActionButtonTypes(node);
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
