/// <reference types="@capacitor/push-notifications" />

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rawaj.marketplace",
  appName: "RAWAJ",
  webDir: ".output/public",
  server: {
    url: "https://rawa-j.com",
    cleartext: false,
    allowNavigation: ["rawa-j.com", "*.rawa-j.com"],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["sound", "alert"],
    },
  },
};

export default config;
