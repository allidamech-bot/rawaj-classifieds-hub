import type { CapacitorConfig } from "@capacitor/cli";

const PRODUCTION_SERVER_URL = "https://rawa-j.com";
const requestedServerUrl = process.env.RAWAJ_ANDROID_SERVER_URL?.trim();

function resolveAndroidServerUrl() {
  if (!requestedServerUrl) return PRODUCTION_SERVER_URL;

  const parsed = new URL(requestedServerUrl);
  if (parsed.protocol !== "https:") {
    throw new Error("RAWAJ_ANDROID_SERVER_URL must use HTTPS.");
  }

  return parsed.origin;
}

const serverUrl = resolveAndroidServerUrl();
const serverHost = new URL(serverUrl).hostname;
const allowNavigation = Array.from(new Set(["rawa-j.com", "*.rawa-j.com", serverHost]));

const config: CapacitorConfig = {
  appId: "com.rawaj.marketplace",
  appName: "RAWAJ",
  webDir: ".output/public",
  backgroundColor: "#080605",
  server: {
    url: serverUrl,
    cleartext: false,
    allowNavigation,
    errorPath: "native-error.html",
  },
};

export default config;
