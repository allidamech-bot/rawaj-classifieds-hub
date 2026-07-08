export type PushPermissionState = "default" | "denied" | "granted" | "unsupported";

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

export function getPushReadinessSnapshot(): PushReadinessSnapshot {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return SERVER_SNAPSHOT;
  }

  const notificationApiSupported = "Notification" in window;
  const serviceWorkerSupported = "serviceWorker" in navigator;
  const pushManagerSupported = "PushManager" in window;
  const secureContext = window.isSecureContext;
  const permission: PushPermissionState = notificationApiSupported
    ? window.Notification.permission
    : "unsupported";

  return {
    notificationApiSupported,
    serviceWorkerSupported,
    pushManagerSupported,
    secureContext,
    permission,
    browserReady:
      notificationApiSupported && serviceWorkerSupported && pushManagerSupported && secureContext,
  };
}
