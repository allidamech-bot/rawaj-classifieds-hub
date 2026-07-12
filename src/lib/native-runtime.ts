import { Capacitor, registerPlugin } from "@capacitor/core";

const RAWAJ_ORIGIN = "https://rawa-j.com";
const RAWAJ_AUTH_SCHEME = "com.rawaj.marketplace";

interface RawajNativePlugin {
  openExternal(options: { url: string }): Promise<void>;
}

const RawajNative = registerPlugin<RawajNativePlugin>("RawajNative");

export function isNativeRawajApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export function createAuthCallbackUrl(
  returnTo: string,
  options: { recovery?: boolean } = {},
): string {
  const callbackUrl = isNativeRawajApp()
    ? new URL(`${RAWAJ_AUTH_SCHEME}://auth/callback`)
    : new URL("/auth/callback", window.location.origin);

  if (options.recovery) callbackUrl.searchParams.set("type", "recovery");
  callbackUrl.searchParams.set("returnTo", returnTo);
  return callbackUrl.toString();
}

export function isRawajWebUrl(url: URL): boolean {
  return (
    url.protocol === "https:" &&
    (url.hostname === "rawa-j.com" || url.hostname.endsWith(".rawa-j.com"))
  );
}

export async function openExternalUrl(url: string): Promise<void> {
  if (isNativeRawajApp()) {
    await RawajNative.openExternal({ url });
    return;
  }

  window.location.assign(url);
}

export function rawajOrigin(): string {
  return RAWAJ_ORIGIN;
}
