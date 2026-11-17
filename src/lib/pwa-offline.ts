import { Capacitor } from "@capacitor/core";

const SCRIPT = "/rawaj-offline-sw.js";

export async function registerInstalledOfflineWorker(): Promise<void> {
  if (typeof window === "undefined" || Capacitor.isNativePlatform()) return;
  if (!window.isSecureContext || !("serviceWorker" in navigator)) return;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!standalone) return;

  try {
    // Never replace another root worker, including a future push registration.
    const registrations = await navigator.serviceWorker.getRegistrations();
    const rootScope = new URL("/", location.origin).href;
    const scriptUrl = new URL(SCRIPT, location.origin).href;
    const existing = registrations.find((registration) => registration.scope === rootScope);
    if (
      existing &&
      [existing.active, existing.waiting, existing.installing].some(
        (worker) => worker && worker.scriptURL !== scriptUrl,
      )
    ) {
      return;
    }
    await navigator.serviceWorker.register(SCRIPT, { scope: "/" });
  } catch {
    // Offline provisioning is best-effort; marketplace and push stay available.
  }
}
