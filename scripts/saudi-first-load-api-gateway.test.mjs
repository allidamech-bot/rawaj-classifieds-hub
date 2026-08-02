import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Saudi browser and SSR data use the custom-domain gateway", async () => {
  const vite = await readFile("vite.config.ts", "utf8");
  assert.match(vite, /const rawajSaudiApiBaseUrl = "https:\/\/sa\.rawa-j\.com";/);
});

test("Saudi Cloudflare server delegates v1 requests through SAUDI_API", async () => {
  const server = await readFile("src/server-cloudflare.ts", "utf8");
  assert.match(server, /SAUDI_API\?: WorkerFetcher/);
  assert.match(server, /const serviceBinding = env\.SAUDI_API/);
  assert.match(server, /serviceBinding \? serviceBinding\.fetch\(proxiedRequest\) : fetch\(proxiedRequest\)/);
  assert.match(server, /proxySaudiApi\(request, env\)/);
});

test("Cloudflare Saudi builds do not render Vercel Analytics", async () => {
  const root = await readFile("src/routes/__root.tsx", "utf8");
  assert.match(root, /rawajBuildInfo\.provider === "vercel" \? <Analytics \/> : null/);
});
