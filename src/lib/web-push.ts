import { getApp } from "firebase/app";
import { getPushReadinessSnapshot } from "@/lib/push-readiness";

const SCOPE = "/rawaj-push/";
const SCRIPT = "/rawaj-push-sw.js";
const VAPID_KEY = import.meta.env.VITE_FIREBASE_WEB_PUSH_VAPID_KEY?.trim() ?? "";

export function webPushAvailable(): boolean {
  return /^[A-Za-z0-9_-]{87}$/.test(VAPID_KEY) && getPushReadinessSnapshot().browserReady;
}

async function waitForActive(registration: ServiceWorkerRegistration): Promise<void> {
  if (registration.active?.state === "activated") return;
  const worker = registration.installing ?? registration.waiting ?? registration.active;
  if (!worker) throw new Error("push_worker_missing");
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(new Error("push_worker_timeout")), 15000);
    function finish(error?: Error) {
      window.clearTimeout(timeout);
      worker?.removeEventListener("statechange", check);
      if (error) reject(error);
      else resolve();
    }
    function check() {
      if (worker?.state === "activated") finish();
      if (worker?.state === "redundant") finish(new Error("push_worker_redundant"));
    }
    worker.addEventListener("statechange", check);
    check();
  });
}

export async function getWebPushToken(): Promise<string> {
  if (!webPushAvailable() || Notification.permission !== "granted") {
    throw new Error("push_unavailable");
  }
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) throw new Error("fcm_unsupported");
  const registration = await navigator.serviceWorker.register(SCRIPT, { scope: SCOPE });
  await waitForActive(registration);
  return getToken(getMessaging(getApp()), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
}

export async function unsubscribeWebPush(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return true;
  try {
    const registration = await navigator.serviceWorker.getRegistration(SCOPE);
    if (!registration || registration.scope !== new URL(SCOPE, location.origin).href) return true;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription && !(await subscription.unsubscribe())) return false;
    for (const notification of await registration.getNotifications()) notification.close();
    return true;
  } catch {
    return false;
  }
}
