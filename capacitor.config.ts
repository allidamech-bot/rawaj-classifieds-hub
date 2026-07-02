import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rawaj.app",
  appName: "RAWAJ",
  webDir: ".output/public",
  server: {
    url: "https://rawa-j.com",
    cleartext: false,
  },
};

export default config;
