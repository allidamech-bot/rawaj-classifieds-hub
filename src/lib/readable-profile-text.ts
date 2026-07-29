export function readableProfileLabel(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;

  // These characters are reliable signs of a double-decoded legacy Arabic
  // value. Suppressing an optional profile label is safer than guessing it.
  return /[\u00ad\u00b5\ufffd]/iu.test(normalized) ? null : normalized;
}
