import { Capacitor } from "@capacitor/core";

/** A separate navigation-only worker; never replaces the Firebase push worker. */
export async function registerRawajOfflineWorker(): Promise<void> {
  if (
    typeof window === "undefined" ||
    !window.isSecureContext ||
    !("serviceWorker" in navigator) ||
    Capacitor.isNativePlatform()
  ) return;

  const standalone = window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!standalone && !mobile) return;

  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing && existing.scope === new URL("/", location.origin).href) {
      const workers = [existing.active, existing.waiting, existing.installing];
      if (workers.some((worker) => worker &&
          new URL(worker.scriptURL).pathname !== "/rawaj-offline-sw.js")) return;
    }
    await navigator.serviceWorker.register("/rawaj-offline-sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  } catch {
    // The online application must remain usable if storage or SW is unavailable.
  }
}
