import { useEffect } from "react";
import { scanDueSavedSearchAlerts } from "@/lib/classifieds-api";
import { emitUnreadActivityChanged } from "@/lib/unread-activity-events";
import { useAuth } from "@/lib/use-auth";

const SCAN_STORAGE_PREFIX = "rawaj:saved-search-background-scan:v1";
const SCAN_THROTTLE_MS = 6 * 60 * 60 * 1000;
const SCAN_START_DELAY_MS = 1_500;

const inFlightScans = new Map<string, Promise<void>>();

type IdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

function scanStorageKey(userId: string) {
  return `${SCAN_STORAGE_PREFIX}:${userId}`;
}

function readLastSuccessfulScan(userId: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const value = Number(window.localStorage.getItem(scanStorageKey(userId)));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function rememberSuccessfulScan(userId: string, timestamp: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(scanStorageKey(userId), String(timestamp));
  } catch {
    // Saved-search alerts remain best-effort when browser storage is unavailable.
  }
}

function isBackgroundScanDue(userId: string, now: number) {
  const lastSuccessfulScan = readLastSuccessfulScan(userId);
  return lastSuccessfulScan === null || now - lastSuccessfulScan >= SCAN_THROTTLE_MS;
}

async function runBackgroundScan(userId: string): Promise<void> {
  const activeScan = inFlightScans.get(userId);
  if (activeScan) return activeScan;

  const startedAt = Date.now();
  if (!isBackgroundScanDue(userId, startedAt)) return;

  const scan = (async () => {
    const result = await scanDueSavedSearchAlerts(userId);
    if (!result.ok) return;

    rememberSuccessfulScan(userId, Date.now());
    if (result.data.createdNotifications > 0) {
      emitUnreadActivityChanged();
    }
  })().finally(() => {
    inFlightScans.delete(userId);
  });

  inFlightScans.set(userId, scan);
  return scan;
}

export function SavedSearchAlertBackgroundScanner() {
  const auth = useAuth();
  const profileId = auth.profile?.id ?? null;

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId || typeof window === "undefined") return;

    const idleWindow = window as IdleWindow;
    let cancelled = false;
    let scheduled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const run = () => {
      scheduled = false;
      if (cancelled || navigator.onLine === false) return;
      void runBackgroundScan(profileId);
    };

    const schedule = () => {
      if (cancelled || scheduled || !isBackgroundScanDue(profileId, Date.now())) return;
      scheduled = true;

      if (typeof idleWindow.requestIdleCallback === "function") {
        idleHandle = idleWindow.requestIdleCallback(run, { timeout: SCAN_START_DELAY_MS });
        return;
      }

      timeoutHandle = setTimeout(run, SCAN_START_DELAY_MS);
    };

    const handleOnline = () => schedule();
    window.addEventListener("online", handleOnline);
    if (navigator.onLine !== false) schedule();

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      if (idleHandle !== null && typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    };
  }, [auth.status, profileId]);

  return null;
}
