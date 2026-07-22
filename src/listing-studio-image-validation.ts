const LISTING_STUDIO_SELECTOR = ".rawaj-listing-studio-v4";
const IMAGE_INPUT_SELECTOR = `${LISTING_STUDIO_SELECTOR} input[type="file"][accept*="image/jpeg"]`;
export const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface ListingImageSelectionValidation {
  accepted: File[];
  rejected: File[];
}

export function validateListingImageSelection(
  files: File[],
): ListingImageSelectionValidation {
  const accepted = files.filter(
    (file) => ALLOWED_IMAGE_TYPES.has(file.type) && file.size <= MAX_LISTING_IMAGE_BYTES,
  );
  return {
    accepted,
    rejected: files.filter((file) => !accepted.includes(file)),
  };
}

function validationMessage(input: HTMLInputElement, rejected: File[]) {
  const studio = input.closest(LISTING_STUDIO_SELECTOR);
  const picker = input.closest("label");
  if (!studio || !picker) return;

  studio.querySelector<HTMLElement>("[data-listing-image-validation]")?.remove();
  if (rejected.length === 0) return;

  const language = document.documentElement.lang.toLowerCase().startsWith("en") ? "en" : "ar";
  const unsupported = rejected.filter((file) => !ALLOWED_IMAGE_TYPES.has(file.type));
  const oversized = rejected.filter((file) => file.size > MAX_LISTING_IMAGE_BYTES);
  const names = rejected.map((file) => file.name).join(language === "ar" ? "، " : ", ");
  const message = document.createElement("p");
  message.dataset.listingImageValidation = "true";
  message.setAttribute("role", "alert");
  message.className =
    "mt-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs font-semibold text-destructive";

  const reasons: string[] = [];
  if (unsupported.length > 0) {
    reasons.push(
      language === "ar"
        ? "الصيغة غير مدعومة؛ استخدم JPEG أو PNG أو WebP"
        : "unsupported format; use JPEG, PNG, or WebP",
    );
  }
  if (oversized.length > 0) {
    reasons.push(language === "ar" ? "حجم الصورة يتجاوز 5MB" : "image size exceeds 5MB");
  }

  message.textContent =
    language === "ar"
      ? `لم تتم إضافة: ${names}. ${reasons.join("، ")}.`
      : `Not added: ${names}. ${reasons.join("; ")}.`;
  picker.insertAdjacentElement("afterend", message);
  message.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function guardImageSelection(event: Event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.matches(IMAGE_INPUT_SELECTOR)) return;

  const validation = validateListingImageSelection(Array.from(input.files ?? []));
  if (validation.rejected.length === 0) {
    validationMessage(input, []);
    return;
  }

  const transfer = new DataTransfer();
  validation.accepted.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
  validationMessage(input, validation.rejected);
}

if (typeof document !== "undefined") {
  document.addEventListener("change", guardImageSelection, true);
}
