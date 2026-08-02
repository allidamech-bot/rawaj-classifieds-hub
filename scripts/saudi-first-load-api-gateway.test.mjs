import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Saudi browser and SSR data use the custom-domain gateway", async () => {
  const vite = await readFile("vite.config.ts", "utf8");
  assert.match(vite, /const rawajSaudiApiBaseUrl = "https:\/\/sa\.rawa-j\.com";/);
  assert.doesNotMatch(
    vite,
    /const rawajSaudiApiBaseUrl = "https:\/\/rawaj-saudi-classifieds\.allidamech\.workers\.dev";/,
  );
});

test("Saudi Cloudflare server delegates v1 requests through SAUDI_API", async () => {
  const server = await readFile("src/server-cloudflare.ts", "utf8");
  assert.match(server, /SAUDI_API\?: WorkerFetcher/);
  assert.match(server, /const serviceBinding = env\.SAUDI_API/);
  assert.match(
    server,
    /new URL\(`\$\{incomingUrl\.pathname\}\$\{incomingUrl\.search\}`, saudiApiOrigin\)/,
  );
  assert.match(server, /await serviceBinding\.fetch\(proxiedRequest\)/);
  assert.match(server, /SAUDI_API_BINDING_FAILURE/);
  assert.match(server, /proxySaudiApi\(request, env\)/);
  assert.doesNotMatch(server, /\? "https:\/\/sa\.rawa-j\.com"\s*:\s*saudiApiOrigin/);
});

test("Cloudflare Saudi builds do not render Vercel Analytics", async () => {
  const root = await readFile("src/routes/__root.tsx", "utf8");
  assert.match(root, /rawajBuildInfo\.provider === "vercel" \? <Analytics \/> : null/);
  assert.doesNotMatch(root, /^\s*<Analytics \/>\s*$/m);
});
