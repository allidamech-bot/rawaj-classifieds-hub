/// <reference types="@capacitor/push-notifications" />

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rawaj.marketplace",
  appName: "رواج | Rawaj",
  webDir: ".output/public",
  server: {
    url: "https://rawa-j.com",
    cleartext: false,
    allowNavigation: ["rawa-j.com", "*.rawa-j.com"],
  },
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
    PushNotifications: {
      presentationOptions: ["sound", "alert"],
    },
  },
};

export default config;
