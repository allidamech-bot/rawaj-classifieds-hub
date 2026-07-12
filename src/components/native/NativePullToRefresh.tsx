import { Capacitor } from "@capacitor/core";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUiPreferences } from "@/lib/ui-preferences";

const REFRESH_THRESHOLD = 64;
const MAX_PULL_DISTANCE = 94;

export function NativePullToRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const { text } = useUiPreferences();
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const distanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const updateDistance = (next: number) => {
      distanceRef.current = next;
      setDistance(next);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (refreshingRef.current || window.scrollY > 0) return;
      startYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const startY = startYRef.current;
      const currentY = event.touches[0]?.clientY;
      if (startY === null || currentY === undefined || window.scrollY > 0) return;

      const delta = currentY - startY;
      if (delta <= 0) {
        updateDistance(0);
        return;
      }

      const next = Math.min(MAX_PULL_DISTANCE, delta * 0.46);
      updateDistance(next);
      if (next > 6) event.preventDefault();
    };

    const finishPull = async () => {
      if (startYRef.current === null) return;
      startYRef.current = null;
      const shouldRefresh = distanceRef.current >= REFRESH_THRESHOLD;
      if (!shouldRefresh || refreshingRef.current) {
        updateDistance(0);
        return;
      }

      refreshingRef.current = true;
      setRefreshing(true);
      updateDistance(REFRESH_THRESHOLD);
      try {
        await onRefreshRef.current();
      } finally {
        refreshingRef.current = false;
        setRefreshing(false);
        window.setTimeout(() => updateDistance(0), 140);
      }
    };

    const cancelPull = () => {
      startYRef.current = null;
      if (!refreshingRef.current) updateDistance(0);
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", finishPull, { passive: true });
    document.addEventListener("touchcancel", cancelPull, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", finishPull);
      document.removeEventListener("touchcancel", cancelPull);
    };
  }, []);

  const progress = Math.min(1, distance / REFRESH_THRESHOLD);
  const visible = distance > 2 || refreshing;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.55rem)] z-[95] flex justify-center transition-opacity duration-150"
      style={{ opacity: visible ? 1 : 0 }}
      aria-live="polite"
    >
      <div
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border/70 bg-card/95 px-4 text-xs font-bold text-primary shadow-lg backdrop-blur"
        style={{
          transform: `translateY(${Math.max(-42, distance - 52)}px) scale(${0.86 + progress * 0.14})`,
        }}
      >
        <RefreshCw
          className={`h-4 w-4 text-brand-orange ${refreshing ? "animate-spin" : ""}`}
          style={{ transform: refreshing ? undefined : `rotate(${progress * 220}deg)` }}
        />
        <span>
          {refreshing
            ? text("جارٍ تحديث الرئيسية", "Refreshing home")
            : progress >= 1
              ? text("اترك للتحديث", "Release to refresh")
              : text("اسحب لتحديث الرئيسية", "Pull to refresh")}
        </span>
      </div>
    </div>
  );
}
