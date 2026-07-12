import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rawaj.marketplace",
  appName: "RAWAJ",
  webDir: ".output/public",
  backgroundColor: "#080605",
  server: {
    url: "https://rawa-j.com",
    cleartext: false,
    allowNavigation: ["rawa-j.com", "*.rawa-j.com"],
    errorPath: "native-error.html",
  },
};

export default config;
