type TurnstileRenderOptions = {
  sitekey: string;
  action: string;
  theme: "auto";
  execution: "execute";
  appearance: "interaction-only";
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
};

type TurnstileApi = {
  render(container: HTMLElement, options: TurnstileRenderOptions): string;
  execute(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_TIMEOUT_MS = 20_000;
const RAWAJ_SYRIA_TURNSTILE_SITE_KEY = "0x4AAAAAAEMj7-5ojy5DWxlr";
let scriptPromise: Promise<TurnstileApi> | null = null;

export function isTurnstileClientConfigured(): boolean {
  return Boolean(siteKey());
}

export async function getTurnstileToken(action: string): Promise<string | null> {
  const key = siteKey();
  if (!key) return null;
  if (typeof document === "undefined") return null;

  const api = await loadTurnstile();
  const overlay = createChallengeOverlay();
  let widgetId: string | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await new Promise<string>((resolve, reject) => {
      const finish = (callback: () => void) => {
        if (timeout) clearTimeout(timeout);
        callback();
      };

      widgetId = api.render(overlay.widget, {
        sitekey: key,
        action,
        theme: "auto",
        execution: "execute",
        appearance: "interaction-only",
        callback: (token) => finish(() => resolve(token)),
        "error-callback": () => finish(() => reject(new Error("turnstile_failed"))),
        "expired-callback": () => finish(() => reject(new Error("turnstile_expired"))),
        "timeout-callback": () => finish(() => reject(new Error("turnstile_timeout"))),
      });

      timeout = setTimeout(() => reject(new Error("turnstile_timeout")), TURNSTILE_TIMEOUT_MS);
      api.execute(widgetId);
    });
  } finally {
    if (timeout) clearTimeout(timeout);
    if (widgetId) {
      try {
        api.remove(widgetId);
      } catch {
        // Best effort cleanup only.
      }
    }
    overlay.root.remove();
  }
}

function siteKey(): string {
  return String(import.meta.env.VITE_TURNSTILE_SITE_KEY ?? RAWAJ_SYRIA_TURNSTILE_SITE_KEY).trim();
}

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SCRIPT_URL}"]`,
    );
    const script = existing ?? document.createElement("script");
    const finish = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("turnstile_unavailable"));
    };

    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("turnstile_unavailable")), {
      once: true,
    });
    if (!existing) {
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

function createChallengeOverlay(): { root: HTMLDivElement; widget: HTMLDivElement } {
  const root = document.createElement("div");
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = "2147483000";
  root.style.display = "grid";
  root.style.placeItems = "center";
  root.style.pointerEvents = "none";

  const widget = document.createElement("div");
  widget.style.pointerEvents = "auto";
  widget.style.minWidth = "300px";
  widget.style.minHeight = "65px";
  widget.style.borderRadius = "14px";
  widget.style.background = "Canvas";
  widget.style.padding = "10px";
  widget.style.boxShadow = "0 12px 40px rgba(0,0,0,.22)";
  root.appendChild(widget);
  document.body.appendChild(root);
  return { root, widget };
}
