import { useEffect, useState, type ReactNode } from "react";

import { SiteFooter } from "@/components/SiteFooter";
import { BottomDock } from "@/components/shell/BottomDock";
import { resolveAppShellConfig } from "@/lib/primary-navigation";

interface AppShellProps {
  pathname: string;
  children: ReactNode;
  announcements?: ReactNode;
  routeClassName?: string;
}

function isEditableElement(target: Element | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.matches("input, textarea, select, [role='textbox']");
}

function useViewportState() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let focusFrame = 0;

    const update = () => {
      const mobileViewport = window.matchMedia("(max-width: 1023px)").matches;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const inset = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      const focusedEditable = mobileViewport && isEditableElement(document.activeElement);
      const nextOpen = mobileViewport && (focusedEditable || inset > 120);

      root.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
      root.style.setProperty("--app-viewport-height", `${Math.round(viewportHeight)}px`);
      root.dataset.keyboardOpen = nextOpen ? "true" : "false";
      setKeyboardOpen(nextOpen);
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(focusFrame);
      focusFrame = window.requestAnimationFrame(update);
    };

    update();
    viewport?.addEventListener("resize", scheduleUpdate);
    viewport?.addEventListener("scroll", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", scheduleUpdate);
    document.addEventListener("focusin", scheduleUpdate);
    document.addEventListener("focusout", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      viewport?.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      document.removeEventListener("focusin", scheduleUpdate);
      document.removeEventListener("focusout", scheduleUpdate);
      root.style.removeProperty("--keyboard-inset");
      root.style.removeProperty("--app-viewport-height");
      delete root.dataset.keyboardOpen;
    };
  }, []);

  return keyboardOpen;
}

export function AppShell({
  pathname,
  children,
  announcements,
  routeClassName = "",
}: AppShellProps) {
  const config = resolveAppShellConfig(pathname);
  const keyboardOpen = useViewportState();

  return (
    <div
      className={`rawaj-app-shell ${routeClassName}`.trim()}
      data-shell-mode={config.mode}
      data-shell-dock={config.showDock}
      data-shell-footer={config.showFooter}
      data-shell-header={config.showHeader}
      data-shell-sticky-action={config.reserveStickyAction}
      data-keyboard-open={keyboardOpen}
    >
      <div className="rawaj-app-shell__page" data-shell-region="page-canvas">
        {announcements ? (
          <div className="rawaj-app-shell__announcements" data-shell-region="announcement-region">
            {announcements}
          </div>
        ) : null}

        <main className="rawaj-app-shell__content" data-shell-region="page-content">
          {children}
        </main>

        {config.showFooter ? <SiteFooter /> : null}
      </div>

      <div
        id="rawaj-floating-layer"
        className="rawaj-app-shell__floating-layer"
        data-shell-region="floating-layer"
        aria-hidden="true"
      />
      <div
        id="rawaj-sticky-action-layer"
        className="rawaj-app-shell__sticky-layer"
        data-shell-region="sticky-action-region"
        aria-hidden="true"
      />

      <BottomDock pathname={pathname} />

      <div
        id="rawaj-modal-layer"
        className="rawaj-app-shell__modal-layer"
        data-shell-region="modal-sheet-region"
        aria-hidden="true"
      />
      <div
        id="rawaj-toast-layer"
        className="rawaj-app-shell__toast-layer"
        data-shell-region="global-toast-region"
        aria-hidden="true"
      />
    </div>
  );
}
