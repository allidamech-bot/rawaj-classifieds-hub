// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const rawajBuildInfo = {
  commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "unknown",
  branch: process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GITHUB_REF_NAME ?? "unknown",
  environment: process.env.VERCEL_ENV ?? (process.env.CI ? "ci" : "development"),
  target: process.env.VERCEL_TARGET_ENV ?? process.env.VERCEL_ENV ?? "unknown",
  builtAt: new Date().toISOString(),
  deploymentUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL ?? "",
  provider: process.env.VERCEL ? "vercel" : process.env.GITHUB_ACTIONS ? "github-actions" : "local",
};

export default defineConfig({
  vite: {
    define: {
      __RAWAJ_BUILD_INFO__: JSON.stringify(rawajBuildInfo),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
