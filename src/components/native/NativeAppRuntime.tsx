import { useEffect, useState } from "react";
import { isNativeRawajApp, isRawajWebUrl, openExternalUrl } from "@/lib/native-runtime";

const EXTERNAL_SCHEMES = new Set([
  "http:",
  "https:",
  "tel:",
  "mailto:",
  "sms:",
  "geo:",
  "market:",
  "whatsapp:",
]);

function shouldOpenExternally(url: URL): boolean {
  if (!EXTERNAL_SCHEMES.has(url.protocol)) return false;
  if (url.protocol === "http:" || url.protocol === "https:") return !isRawajWebUrl(url);
  return true;
}

export function NativeAppRuntime() {
  const native = isNativeRawajApp();
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    if (!native) return;

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (!shouldOpenExternally(url)) return;
      event.preventDefault();
      void openExternalUrl(url.toString()).catch((error) => {
        console.error("Unable to open external URL", error);
      });
    };

    const originalOpen = window.open.bind(window);
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      if (url) {
        try {
          const resolved = new URL(url.toString(), window.location.href);
          if (shouldOpenExternally(resolved)) {
            void openExternalUrl(resolved.toString()).catch((error) => {
              console.error("Unable to open external window", error);
            });
            return null;
          }
        } catch {
          // Let the browser handle malformed or app-local values normally.
        }
      }
      return originalOpen(url, target, features);
    }) as typeof window.open;

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.open = originalOpen;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [native]);

  if (!native || online) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[120] mx-auto flex max-w-lg items-center justify-between gap-3 rounded-2xl border border-amber-300/25 bg-[#160c07]/95 px-4 py-3 text-sm text-[#fff1d0] shadow-2xl backdrop-blur"
    >
      <div>
        <strong className="block">لا يوجد اتصال بالإنترنت</strong>
        <span className="text-xs text-[#fff1d0]/75">تحقق من الشبكة ثم أعد المحاولة.</span>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-xl bg-[#e9b85e] px-3 py-2 text-xs font-bold text-[#160c07]"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
