import { Capacitor, registerPlugin } from "@capacitor/core";

const RAWAJ_AUTH_CALLBACK = "com.rawaj.marketplace://auth/callback";

interface RawajNativePlugin {
  openExternal(options: { url: string }): Promise<void>;
  getAuthStorage(options: { key: string }): Promise<{ value: string | null }>;
  setAuthStorage(options: { key: string; value: string }): Promise<void>;
  removeAuthStorage(options: { key: string }): Promise<void>;
}

const RawajNative = registerPlugin<RawajNativePlugin>("RawajNative");

export function isNativeRawajApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

function localStorageValue(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function mirrorLocalStorage(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Native SharedPreferences remains the source of truth when WebView storage is unavailable.
  }
}

export const rawajAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!isNativeRawajApp()) return localStorageValue(key);

    try {
      const result = await RawajNative.getAuthStorage({ key });
      if (typeof result.value === "string") {
        mirrorLocalStorage(key, result.value);
        return result.value;
      }

      const legacyValue = localStorageValue(key);
      if (legacyValue !== null) {
        await RawajNative.setAuthStorage({ key, value: legacyValue });
      }
      return legacyValue;
    } catch {
      return localStorageValue(key);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    mirrorLocalStorage(key, value);
    if (!isNativeRawajApp()) return;

    await RawajNative.setAuthStorage({ key, value });
  },

  async removeItem(key: string): Promise<void> {
    mirrorLocalStorage(key, null);
    if (!isNativeRawajApp()) return;

    await RawajNative.removeAuthStorage({ key });
  },
};

export function createAuthCallbackUrl(
  returnTo: string,
  options: { recovery?: boolean } = {},
): string {
  const callbackUrl = isNativeRawajApp()
    ? new URL(RAWAJ_AUTH_CALLBACK)
    : new URL("/auth/callback", window.location.origin);

  if (options.recovery) callbackUrl.searchParams.set("type", "recovery");
  callbackUrl.searchParams.set("returnTo", returnTo);
  return callbackUrl.toString();
}

export function isRawajWebUrl(url: URL): boolean {
  const sameAppOrigin = typeof window !== "undefined" && url.origin === window.location.origin;
  return (
    sameAppOrigin ||
    (url.protocol === "https:" &&
      (url.hostname === "rawa-j.com" || url.hostname.endsWith(".rawa-j.com")))
  );
}

export async function openExternalUrl(url: string): Promise<void> {
  if (isNativeRawajApp()) {
    await RawajNative.openExternal({ url });
    return;
  }

  window.location.assign(url);
}
