// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { createRawajE2eApiFixturePlugin } from "./e2e/rawaj-e2e-api-fixtures";
import { createRawajE2ePrivateFixturePlugin } from "./e2e/rawaj-e2e-private-fixtures";

const rawajBuildInfo = {
  commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "unknown",
  branch: process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GITHUB_REF_NAME ?? "unknown",
  environment: process.env.VERCEL_ENV ?? (process.env.CI ? "ci" : "development"),
  target: process.env.VERCEL_TARGET_ENV ?? process.env.VERCEL_ENV ?? "unknown",
  builtAt: new Date().toISOString(),
  deploymentUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL ?? "",
  provider: process.env.VERCEL ? "vercel" : process.env.GITHUB_ACTIONS ? "github-actions" : "local",
};

const rawajDisableRemoteMedia =
  process.env.VITE_RAWAJ_E2E_DISABLE_REMOTE_MEDIA === "1" || process.env.GITHUB_ACTIONS === "true";

const rawajE2eUseFixtures = process.env.RAWAJ_E2E_USE_FIXTURES === "1";
const rawajE2eApiProxyTarget = process.env.RAWAJ_E2E_API_PROXY_TARGET?.trim();
const rawajE2eApiProxyPath = "/v1";
const rawajE2eLocalApiBaseUrl = "http://127.0.0.1:4173";

export default defineConfig({
  vite: {
    plugins: rawajE2eUseFixtures
      ? [createRawajE2ePrivateFixturePlugin(), createRawajE2eApiFixturePlugin()]
      : [],
    server: rawajE2eApiProxyTarget
      ? {
          proxy: {
            [rawajE2eApiProxyPath]: {
              target: rawajE2eApiProxyTarget,
              changeOrigin: true,
              secure: true,
            },
          },
        }
      : undefined,
    resolve: {
      alias: [
        ...(rawajE2eUseFixtures
          ? [
              {
                find: /^firebase\/auth$/,
                replacement: fileURLToPath(
                  new URL("./e2e/firebase-auth-fixture.ts", import.meta.url),
                ),
              },
            ]
          : []),
        {
          find: "@/lib/api/taxonomy-metadata",
          replacement: fileURLToPath(
            new URL("./src/lib/api/taxonomy-metadata-cloudflare.ts", import.meta.url),
          ),
        },
        {
          find: "@/lib/api/ad-placements",
          replacement: fileURLToPath(
            new URL("./src/lib/api/ad-placements-cloudflare.ts", import.meta.url),
          ),
        },
      ],
    },
    define: {
      ...(rawajE2eUseFixtures
        ? {
            "import.meta.env.VITE_PUBLIC_DATA_API_BASE_URL":
              JSON.stringify(rawajE2eLocalApiBaseUrl),
          }
        : {}),
      __RAWAJ_BUILD_INFO__: JSON.stringify(rawajBuildInfo),
      __RAWAJ_DISABLE_REMOTE_MEDIA__: JSON.stringify(rawajDisableRemoteMedia),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
