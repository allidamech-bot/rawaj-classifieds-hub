import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const usesExternalServer = Boolean(process.env.E2E_BASE_URL);
const usesLocalFixtures = process.env.RAWAJ_E2E_USE_FIXTURES === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // A cold TanStack/Vite SSR graph can take longer than eight seconds to
  // hydrate on CI. Keep a bounded allowance here; workflow throughput is
  // handled by sharding rather than by extending the job time limit.
  timeout: 60_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL,
    locale: "ar-SY",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "desktop-firefox",
      use: { ...devices["Desktop Firefox"], browserName: "firefox" },
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
  ],
  webServer: usesExternalServer
    ? undefined
    : {
        // E2E runs do not need Lovable's development-only source tagger. Keeping
        // it disabled prevents its client-only JSX annotations from differing
        // from the SSR markup and aborting hydration.
        command: "npm run dev -- --mode e2e --host 127.0.0.1 --port 4173",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: usesLocalFixtures
          ? {
              ...process.env,
              VITE_PUBLIC_DATA_API_BASE_URL: baseURL,
            }
          : process.env,
      },
});
