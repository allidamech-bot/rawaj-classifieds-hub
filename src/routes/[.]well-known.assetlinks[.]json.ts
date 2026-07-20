import { createFileRoute } from "@tanstack/react-router";
import {
  buildAndroidAssetLinksStatements,
  parseAndroidSha256Fingerprints,
  RAWAJ_ANDROID_FINGERPRINT_ENV_NAME,
} from "@/lib/production-linking";

export const Route = createFileRoute("/.well-known/assetlinks.json")({
  server: {
    handlers: {
      GET: async () => {
        const fingerprints = parseAndroidSha256Fingerprints(
          process.env[RAWAJ_ANDROID_FINGERPRINT_ENV_NAME],
        );

        if (fingerprints.length === 0) {
          return new Response(
            JSON.stringify({ error: "android_app_links_not_configured" }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "no-store",
                "Retry-After": "300",
                "X-Content-Type-Options": "nosniff",
              },
            },
          );
        }

        return new Response(
          JSON.stringify(buildAndroidAssetLinksStatements(fingerprints)),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
              "X-Content-Type-Options": "nosniff",
            },
          },
        );
      },
    },
  },
});
