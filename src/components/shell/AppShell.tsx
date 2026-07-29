import { useEffect, useState, type ReactNode } from "react";

import { SiteFooter } from "@/components/SiteFooter";
import { BottomDock } from "@/components/shell/BottomDock";
import { resolveAppShellConfig } from "@/lib/primary-navigation";
import { useUiPreferences } from "@/lib/ui-preferences";

interface AppShellProps {
  pathname: string;
  children: ReactNode;
  announcements?: ReactNode;
  routeClassName?: string;
  isRouteNavigating?: boolean;
  pendingPathname?: string;
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
    root.dataset.rawajHydrated = "true";
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
      delete root.dataset.rawajHydrated;
    };
  }, []);

  return keyboardOpen;
}

function useDarkBrowserChrome() {
  useEffect(() => {
    const root = document.documentElement;
    root.style.colorScheme = "dark";

    let themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.name = "theme-color";
      document.head.appendChild(themeMeta);
    }
    themeMeta.content = "#242529";
  }, []);
}

function elementHasAccessibleFieldName(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  if (field.getAttribute("aria-label")?.trim()) return true;
  if (field.getAttribute("aria-labelledby")?.trim()) return true;

  if (field.id) {
    const explicitLabel = document.querySelector<HTMLLabelElement>(
      `label[for="${CSS.escape(field.id)}"]`,
    );
    if (explicitLabel?.textContent?.trim()) return true;
  }

  const wrappingLabel = field.closest("label");
  return Boolean(wrappingLabel?.textContent?.trim());
}

function applyAccessibleFieldNameFallbacks() {
  const fields = document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    "input:not([type='hidden']):not([type='button']):not([type='submit']), select, textarea",
  );

  for (const field of fields) {
    if (elementHasAccessibleFieldName(field)) continue;
    const fallback = field.getAttribute("placeholder")?.trim() || field.getAttribute("title")?.trim();
    if (fallback) field.setAttribute("aria-label", fallback);
  }
}

function useAccessibleFieldNameFallbacks(pathname: string) {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;

    const applyAndSignal = () => {
      applyAccessibleFieldNameFallbacks();
      root.dataset.rawajA11yReady = "true";
    };

    applyAndSignal();
    const observer = new MutationObserver(() => {
      root.dataset.rawajA11yReady = "pending";
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(applyAndSignal);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      delete root.dataset.rawajA11yReady;
    };
  }, [pathname]);
}

export function AppShell({
  pathname,
  children,
  announcements,
  routeClassName = "",
  isRouteNavigating = false,
  pendingPathname,
}: AppShellProps) {
  const config = resolveAppShellConfig(pathname);
  const keyboardOpen = useViewportState();
  const { text } = useUiPreferences();
  useDarkBrowserChrome();
  useAccessibleFieldNameFallbacks(pathname);

  return (
    <div
      className={`rawaj-app-shell ${routeClassName}`.trim()}
      data-shell-mode={config.mode}
      data-shell-dock={config.showDock}
      data-shell-footer={config.showFooter}
      data-shell-header={config.showHeader}
      data-shell-sticky-action={config.reserveStickyAction}
      data-keyboard-open={keyboardOpen}
      data-route-state={isRouteNavigating ? "pending" : "idle"}
      data-resolved-pathname={pathname}
      data-pending-pathname={isRouteNavigating ? pendingPathname : undefined}
      aria-busy={isRouteNavigating}
    >
      <div className="rawaj-app-shell__page" data-shell-region="page-canvas">
        {announcements ? (
          <div className="rawaj-app-shell__announcements" data-shell-region="announcement-region">
            {announcements}
          </div>
        ) : null}

        <div className="rawaj-app-shell__content" data-shell-region="page-content">
          {children}
        </div>

        {config.showFooter ? <SiteFooter pathname={pathname} /> : null}
      </div>

      {isRouteNavigating ? (
        <div
          className="rawaj-route-pending-mask"
          data-shell-region="route-pending-mask"
          role="status"
          aria-live="polite"
          aria-label={text("جاري فتح الصفحة", "Opening page")}
        >
          <div className="rawaj-route-pending-mask__content">
            <span className="rawaj-route-pending-mask__spinner" aria-hidden="true" />
            <span>{text("جاري فتح الصفحة...", "Opening page...")}</span>
          </div>
        </div>
      ) : null}

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
