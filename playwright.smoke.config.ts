import { defineConfig } from "@playwright/test";

import baseConfig from "./playwright.config";

export default defineConfig(baseConfig, {
  // This exact rendered-layout matrix remains required in Rendered Visual QA.
  // Browser Smoke keeps every other E2E, accessibility, and acceptance spec.
  testIgnore: ["**/rendered-visual-qa.spec.ts"],
});
