import type { CapacitorConfig } from "@capacitor/cli";

const PRODUCTION_SERVER_URL = "https://rawa-j.com";
const bundledPreview = process.env.RAWAJ_ANDROID_BUNDLED_PREVIEW === "1";
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
  server: bundledPreview
    ? {
        androidScheme: "https",
        cleartext: false,
        allowNavigation: ["rawa-j.com", "*.rawa-j.com"],
        errorPath: "native-error.html",
      }
    : {
        url: serverUrl,
        cleartext: false,
        allowNavigation,
        errorPath: "native-error.html",
      },
};

export default config;
