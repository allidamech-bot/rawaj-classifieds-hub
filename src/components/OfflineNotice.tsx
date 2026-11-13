import { WifiOff, Wrench } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { useUiPreferences } from "@/lib/ui-preferences";

interface PublicSystemStatus {
  maintenanceMode: boolean;
  emergencyReadOnly: boolean;
}

// Low-traffic deployments must not poll Cloudflare on every idle browser tab.
const SYSTEM_STATUS_REFRESH_MS = 5 * 60_000;
const SYSTEM_STATUS_RATE_LIMIT_BACKOFF_MS = 30 * 60_000;

export function OfflineNotice() {
  const { text } = useUiPreferences();
  const [online, setOnline] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const requestInFlightRef = useRef(false);
  const nextAllowedCheckAtRef = useRef(0);

  const refreshSystemStatus = useCallback(async (force = false) => {
    if (typeof document === "undefined" || typeof navigator === "undefined") return;
    if (navigator.onLine === false || requestInFlightRef.current) return;
    if (!force && document.visibilityState !== "visible") return;
    if (!force && Date.now() < nextAllowedCheckAtRef.current) return;

    requestInFlightRef.current = true;
    nextAllowedCheckAtRef.current = Date.now() + SYSTEM_STATUS_REFRESH_MS;

    try {
      const result = await cloudflareApiRequest<PublicSystemStatus>("/v1/system-status");
      if (result.ok) {
        setMaintenanceMode(result.data.maintenanceMode);
      } else if (result.error.code === "rate_limited") {
        // A Cloudflare 429 must not trigger more background pressure.
        nextAllowedCheckAtRef.current = Date.now() + SYSTEM_STATUS_RATE_LIMIT_BACKOFF_MS;
      }
    } finally {
      requestInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const updateConnectionState = () => setOnline(navigator.onLine);
    updateConnectionState();
    window.addEventListener("online", updateConnectionState);
    window.addEventListener("offline", updateConnectionState);
    return () => {
      window.removeEventListener("online", updateConnectionState);
      window.removeEventListener("offline", updateConnectionState);
    };
  }, []);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshSystemStatus();
    };
    const refreshAfterOwnerChange = () => void refreshSystemStatus(true);

    void refreshSystemStatus();
    const interval = window.setInterval(() => void refreshSystemStatus(), SYSTEM_STATUS_REFRESH_MS);
    window.addEventListener("focus", refreshAfterOwnerChange);
    window.addEventListener("rawaj:system-control-changed", refreshAfterOwnerChange);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshAfterOwnerChange);
      window.removeEventListener("rawaj:system-control-changed", refreshAfterOwnerChange);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshSystemStatus]);

  if (online && !maintenanceMode) return null;

  return (
    <>
      {maintenanceMode ? (
        <div
          role="status"
          aria-live="polite"
          className="rawaj-maintenance-notice border-b border-destructive/35 bg-destructive px-4 py-2.5 text-center text-xs font-extrabold text-destructive-foreground shadow-sm"
        >
          <span className="inline-flex items-center gap-2">
            <Wrench className="h-4 w-4" aria-hidden="true" />
            {text("الموقع في وضع الصيانة حاليًا.", "The website is currently under maintenance.")}
          </span>
        </div>
      ) : null}

      {!online ? (
        <div
          role="status"
          aria-live="polite"
          className="rawaj-offline-notice border-b border-warning/25 bg-warning/10 px-4 py-2 text-center text-xs font-semibold text-foreground"
        >
          <span className="inline-flex items-center gap-2">
            <WifiOff className="h-4 w-4" aria-hidden="true" />
            {text("لا يوجد اتصال بالإنترنت", "No internet connection")}
          </span>
        </div>
      ) : null}
    </>
  );
}
