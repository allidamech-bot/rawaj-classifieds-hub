import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const configPath = resolve(process.cwd(), "wrangler.generated.jsonc");
const officialOrigins = "https://rawa-j.com,https://www.rawa-j.com";

let source;
try {
  source = await readFile(configPath, "utf8");
} catch (error) {
  throw new Error(`Missing wrangler.generated.jsonc: ${error instanceof Error ? error.message : String(error)}`);
}

let next = source;

if (/"main"\s*:\s*"[^"]+"/.test(next)) {
  next = next.replace(/"main"\s*:\s*"[^"]+"/, '"main": "src/entry.ts"');
} else {
  next = next.replace(/\{/, '{\n  "main": "src/entry.ts",');
}

if (/"API_ALLOWED_ORIGINS"\s*:\s*"[^"]*"/.test(next)) {
  next = next.replace(
    /"API_ALLOWED_ORIGINS"\s*:\s*"[^"]*"/,
    `"API_ALLOWED_ORIGINS": "${officialOrigins}"`,
  );
}

await writeFile(configPath, next, "utf8");
console.log("Prepared wrangler.generated.jsonc for src/entry.ts and official CORS origins.");
