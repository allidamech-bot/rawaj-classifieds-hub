export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function scrollPageToTop(): void {
  if (typeof window === "undefined") return;
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}
