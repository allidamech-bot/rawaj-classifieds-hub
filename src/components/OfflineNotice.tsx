import { WifiOff, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { useUiPreferences } from "@/lib/ui-preferences";

interface PublicSystemStatus {
  maintenanceMode: boolean;
  emergencyReadOnly: boolean;
}

const SYSTEM_STATUS_REFRESH_MS = 60_000;

export function OfflineNotice() {
  const { text } = useUiPreferences();
  const [online, setOnline] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const refreshSystemStatus = useCallback(async () => {
    const result = await cloudflareApiRequest<PublicSystemStatus>("/v1/system-status");
    if (result.ok) setMaintenanceMode(result.data.maintenanceMode);
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
    const refreshAfterOwnerChange = () => void refreshSystemStatus();

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
