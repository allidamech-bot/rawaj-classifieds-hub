import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useUiPreferences } from "@/lib/ui-preferences";

export function OfflineNotice() {
  const { text } = useUiPreferences();
  const [online, setOnline] = useState(true);

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

  if (online) return null;

  return (
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
  );
}
