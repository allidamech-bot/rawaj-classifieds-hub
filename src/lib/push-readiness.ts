import { useSyncExternalStore } from "react";

export type PushPermissionState = NotificationPermission | "unsupported";

export interface PushReadinessSnapshot {
  notificationApiSupported: boolean;
  serviceWorkerSupported: boolean;
  pushManagerSupported: boolean;
  secureContext: boolean;
  permission: PushPermissionState;
  browserReady: boolean;
}

const SERVER_SNAPSHOT: PushReadinessSnapshot = {
  notificationApiSupported: false,
  serviceWorkerSupported: false,
  pushManagerSupported: false,
  secureContext: false,
  permission: "unsupported",
  browserReady: false,
};

let cachedClientSnapshot: PushReadinessSnapshot | null = null;

function readPushReadinessSnapshot(): PushReadinessSnapshot {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return SERVER_SNAPSHOT;
  }

  if (cachedClientSnapshot) return cachedClientSnapshot;

  const notificationApiSupported = "Notification" in window;
  const serviceWorkerSupported = "serviceWorker" in navigator;
  const pushManagerSupported = "PushManager" in window;
  const secureContext = window.isSecureContext;
  const permission: PushPermissionState = notificationApiSupported
    ? window.Notification.permission
    : "unsupported";

  cachedClientSnapshot = {
    notificationApiSupported,
    serviceWorkerSupported,
    pushManagerSupported,
    secureContext,
    permission,
    browserReady:
      notificationApiSupported &&
      serviceWorkerSupported &&
      pushManagerSupported &&
      secureContext,
  };

  return cachedClientSnapshot;
}

function subscribePushReadiness() {
  return () => undefined;
}

export function usePushReadinessSnapshot(): PushReadinessSnapshot {
  return useSyncExternalStore(
    subscribePushReadiness,
    readPushReadinessSnapshot,
    () => SERVER_SNAPSHOT,
  );
}
