import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const runtimeEnvFiles = [".env", ".env.production", ".env.example"];

for (const path of runtimeEnvFiles) {
  test(`${path} does not configure Supabase runtime access`, async () => {
    const content = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.doesNotMatch(content, /VITE_SUPABASE_(?:URL|ANON_KEY)/);
    assert.doesNotMatch(content, /\.supabase\.co/i);
    assert.match(content, /VITE_PUBLIC_DATA_PROVIDER=cloudflare/);
    assert.match(
      content,
      /VITE_PUBLIC_DATA_API_BASE_URL=https:\/\/rawaj-classifieds-hub\.allidamech\.workers\.dev/,
    );
  });
}

test("frontend runtime does not embed the retired Supabase project endpoint", async () => {
  const files = [
    "src/server.ts",
    "src/lib/public-data/config.ts",
    "src/lib/public-data/cloudflare-client.ts",
    "src/lib/classifieds-api.ts",
    "src/lib/supabase.ts",
  ];

  for (const path of files) {
    const content = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.doesNotMatch(content, /dpymopdckflnpmowhlyq\.supabase\.co/i, path);
  }
});

test("Supabase compatibility module cannot initialize an SDK client", async () => {
  const content = await readFile(new URL("../src/lib/supabase.ts", import.meta.url), "utf8");
  assert.doesNotMatch(content, /\bcreateClient\s*\(/);
  assert.doesNotMatch(content, /import\s*\{[^}]*\bcreateClient\b/);
  assert.match(content, /export const supabase:[^=]+?= null;/s);
  assert.match(content, /export const publicSupabase:[^=]+?= null;/s);
  assert.match(content, /export const isSupabaseConfigured = false;/);
});
