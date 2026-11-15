import { WifiOff, Wrench } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { useUiPreferences } from "@/lib/ui-preferences";

interface PublicSystemStatus {
  maintenanceMode: boolean;
  emergencyReadOnly: boolean;
}

// The public shell must not poll Cloudflare every minute from background tabs.
const SYSTEM_STATUS_REFRESH_MS = 5 * 60_000;
const SYSTEM_STATUS_FAILURE_BACKOFF_MS = 15 * 60_000;

export function OfflineNotice() {
  const { text } = useUiPreferences();
  const [online, setOnline] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const nextRequestAtRef = useRef(0);
  const requestInFlightRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshSystemStatus = useCallback(async (force = false) => {
    if (document.visibilityState !== "visible" || navigator.onLine === false) return;
    if (requestInFlightRef.current || (!force && Date.now() < nextRequestAtRef.current)) {
      return;
    }

    requestInFlightRef.current = true;
    try {
      const result = await cloudflareApiRequest<PublicSystemStatus>("/v1/system-status");
      if (!mountedRef.current) return;
      if (result.ok) {
        setMaintenanceMode(result.data.maintenanceMode);
        nextRequestAtRef.current = Date.now() + SYSTEM_STATUS_REFRESH_MS;
      } else {
        // When Workers hit a quota/network error, focus and visibility events
        // must not create a new request storm across every open tab.
        nextRequestAtRef.current = Date.now() + SYSTEM_STATUS_FAILURE_BACKOFF_MS;
      }
    } catch {
      nextRequestAtRef.current = Date.now() + SYSTEM_STATUS_FAILURE_BACKOFF_MS;
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
    const refreshWhenVisible = () => void refreshSystemStatus();
    // Owner changes bypass the cooldown; the next status must be visible immediately.
    const refreshAfterOwnerChange = () => void refreshSystemStatus(true);

    void refreshSystemStatus();
    const interval = window.setInterval(refreshWhenVisible, SYSTEM_STATUS_REFRESH_MS);
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);
    window.addEventListener("rawaj:system-control-changed", refreshAfterOwnerChange);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
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
