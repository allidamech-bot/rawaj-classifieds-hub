import { App, type PluginListenerHandle } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeAuthReturnTo } from "./auth-return";

const nativeScheme = "com.rawaj.marketplace";
const nativeAuthHost = "auth";
const nativeAuthPath = "/callback";
const webAuthHost = "rawa-j.com";

export type AuthCallbackKind = "oauth" | "recovery" | "confirmation";

export interface AuthCallbackCompletion {
  returnTo: string;
  kind: AuthCallbackKind;
}

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function buildAuthCallbackUrl(
  returnTo: string,
  kind: AuthCallbackKind = "oauth",
): string {
  const safeReturnTo = sanitizeAuthReturnTo(returnTo, "/more");
  const callbackUrl = isNativeApp()
    ? new URL(`${nativeScheme}://${nativeAuthHost}${nativeAuthPath}`)
    : new URL("/auth/callback", window.location.origin);

  callbackUrl.searchParams.set("returnTo", safeReturnTo);
  if (kind !== "oauth") callbackUrl.searchParams.set("type", kind);
  return callbackUrl.toString();
}

export function isSupportedAuthCallbackUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const isCustomScheme =
      url.protocol === `${nativeScheme}:` &&
      url.hostname === nativeAuthHost &&
      url.pathname === nativeAuthPath;
    const isVerifiedWebFallback =
      url.protocol === "https:" && url.hostname === webAuthHost && url.pathname === "/auth/callback";

    return isCustomScheme || isVerifiedWebFallback;
  } catch {
    return false;
  }
}

function callbackParams(rawUrl: string) {
  const url = new URL(rawUrl);
  const params = new URLSearchParams(url.search);
  const fragment = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;

  for (const [key, value] of new URLSearchParams(fragment)) {
    if (!params.has(key)) params.set(key, value);
  }

  return params;
}

function callbackError(params: URLSearchParams) {
  return params.get("error_description") ?? params.get("error") ?? null;
}

function callbackKind(params: URLSearchParams): AuthCallbackKind {
  const rawType = params.get("type");
  if (rawType === "recovery") return "recovery";
  if (rawType === "confirmation") return "confirmation";
  return "oauth";
}

export async function completeNativeAuthCallback(
  client: SupabaseClient,
  rawUrl: string,
): Promise<AuthCallbackCompletion | null> {
  if (!isSupportedAuthCallbackUrl(rawUrl)) return null;

  const params = callbackParams(rawUrl);
  const remoteError = callbackError(params);
  if (remoteError) throw new Error(remoteError);

  const code = params.get("code");
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } else {
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken && refreshToken) {
      const { error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
    } else {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data.session) throw new Error("The authentication callback did not contain a session.");
    }
  }

  return {
    returnTo: sanitizeAuthReturnTo(params.get("returnTo") ?? undefined, "/more"),
    kind: callbackKind(params),
  };
}

export async function openNativeAuthBrowser(url: string) {
  await Browser.open({ url });
}

export async function closeNativeAuthBrowser() {
  try {
    await Browser.close();
  } catch {
    // Android closes its Custom Tab when the deep link brings the Activity forward.
  }
}

export async function subscribeToNativeAuthCallbacks(
  listener: (url: string) => void | Promise<void>,
): Promise<() => Promise<void>> {
  let handle: PluginListenerHandle | undefined;

  handle = await App.addListener("appUrlOpen", ({ url }) => {
    void listener(url);
  });

  const launch = await App.getLaunchUrl();
  if (launch?.url) await listener(launch.url);

  return async () => {
    await handle?.remove();
  };
}
