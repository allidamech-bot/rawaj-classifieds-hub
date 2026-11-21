import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUiPreferences } from "@/lib/ui-preferences";

type RefreshRegistration = { register: (task: Promise<unknown>) => void };

const THRESHOLD = 76;
const MAX_PULL = 116;

export function pullToRefreshEnabled(pathname: string) {
  return (
    [
      "/",
      "/categories",
      "/listings",
      "/chats",
      "/notifications",
      "/favorites",
      "/saved-searches",
      "/activity",
      "/more",
      "/profile",
    ].includes(pathname) || /^\/(?:category|syria|seller|listings)\/[^/]+$/.test(pathname)
  );
}

function scrollContainer(target: Element | null): HTMLElement | null {
  let node: Element | null = target;
  while (node && node !== document.body) {
    if (node instanceof HTMLElement && node.scrollHeight > node.clientHeight + 3) {
      const overflow = getComputedStyle(node).overflowY;
      if (overflow === "auto" || overflow === "scroll") return node;
    }
    node = node.parentElement;
  }
  return null;
}

function allowGestureTarget(target: Element | null) {
  return !target?.closest(
    'input, textarea, select, [contenteditable="true"], [role="dialog"], ' +
      '[role="slider"], .embla, .rawaj-message-composer, .rawaj-modal-layer, ' +
      ".rawaj-app-shell__floating-layer, button, a, [data-pull-refresh-ignore]",
  );
}

export function PullToRefresh({ pathname, disabled }: { pathname: string; disabled: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { text } = useUiPreferences();
  const [distance, setDistance] = useState(0);
  const [phase, setPhase] = useState<"idle" | "refreshing" | "offline">("idle");
  const busyRef = useRef(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabled = pullToRefreshEnabled(pathname) && !disabled;

  useEffect(() => {
    if (!enabled) return;
    let startY = 0;
    let startX = 0;
    let currentDistance = 0;
    let active = false;
    let scrollParent: HTMLElement | null = null;
    let dismissed = false;

    function clearGesture() {
      active = false;
      currentDistance = 0;
      scrollParent = null;
      setDistance(0);
    }

    function start(event: TouchEvent) {
      if (
        busyRef.current ||
        !window.matchMedia("(max-width: 1023px)").matches ||
        event.touches.length !== 1 ||
        document.documentElement.dataset.keyboardOpen === "true" ||
        !allowGestureTarget(event.target instanceof Element ? event.target : null) ||
        window.scrollY > 2 ||
        (document.scrollingElement?.scrollTop ?? 0) > 2
      ) {
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      scrollParent = scrollContainer(target);
      if (scrollParent && scrollParent.scrollTop > 2) return;
      startY = event.touches[0].clientY;
      startX = event.touches[0].clientX;
      active = true;
      dismissed = false;
    }

    function move(event: TouchEvent) {
      if (!active || event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - startX;
      const dy = event.touches[0].clientY - startY;
      if (dy < -4 || (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy))) {
        clearGesture();
        return;
      }
      if (
        window.scrollY > 2 ||
        (document.scrollingElement?.scrollTop ?? 0) > 2 ||
        (scrollParent && scrollParent.scrollTop > 2)
      ) {
        clearGesture();
        return;
      }
      if (dy < 8) return;
      if (event.cancelable) event.preventDefault();
      currentDistance = Math.min(MAX_PULL, Math.round(dy * 0.55));
      setDistance(currentDistance);
    }

    async function finish() {
      if (!active) return;
      const shouldRefresh = currentDistance >= THRESHOLD && !dismissed && !busyRef.current;
      clearGesture();
      if (!shouldRefresh) return;
      if (resetTimer.current) clearTimeout(resetTimer.current);
      if (navigator.onLine === false) {
        setPhase("offline");
        resetTimer.current = setTimeout(() => setPhase("idle"), 1500);
        return;
      }
      busyRef.current = true;
      setPhase("refreshing");
      const tasks: Promise<unknown>[] = [];
      const registration: RefreshRegistration = {
        register(task) {
          tasks.push(task);
        },
      };
      window.dispatchEvent(
        new CustomEvent<RefreshRegistration>("rawaj:pull-refresh", {
          detail: registration,
        }),
      );
      tasks.push(Promise.resolve(router.invalidate()));
      tasks.push(queryClient.invalidateQueries({ refetchType: "active" }));
      try {
        await Promise.allSettled(tasks);
      } finally {
        busyRef.current = false;
        resetTimer.current = setTimeout(() => setPhase("idle"), 350);
      }
    }

    function cancel() {
      dismissed = true;
      clearGesture();
    }

    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", finish, { passive: true });
    document.addEventListener("touchcancel", cancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", finish);
      document.removeEventListener("touchcancel", cancel);
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, [enabled, pathname, router, queryClient]);

  if (!enabled || (distance === 0 && phase === "idle")) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="rawaj-pull-refresh-indicator"
      data-state={phase}
      className="pointer-events-none fixed inset-x-0 z-[120] flex justify-center"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
    >
      <div className="flex min-h-11 items-center gap-2 rounded-full border border-[#e3e7e4] bg-white px-4 py-2 text-sm font-semibold text-[#103f42] shadow-sm">
        <RefreshCw
          size={17}
          aria-hidden="true"
          className={phase === "refreshing" ? "animate-spin" : ""}
          style={distance ? { transform: `rotate(${Math.min(distance * 3, 270)}deg)` } : undefined}
        />
        <span>
          {phase === "refreshing"
            ? text("جارٍ التحديث...", "Refreshing...")
            : phase === "offline"
              ? text("لا يوجد اتصال بالإنترنت", "No internet connection")
              : distance >= THRESHOLD
                ? text("اترك للتحديث", "Release to refresh")
                : text("اسحب للتحديث", "Pull to refresh")}
        </span>
      </div>
    </div>
  );
}
