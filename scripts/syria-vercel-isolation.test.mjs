import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const vercelConfig = JSON.parse(read("vercel.json"));
const environment = read(".env.example");

const activeConfiguration = `${JSON.stringify(vercelConfig)}\n${environment}`;

test("Syria Vercel Git deployments remain disabled during separation", () => {
  assert.equal(vercelConfig.git?.deploymentEnabled, false);
});

test("Syria repository has no local or Saudi Vercel linkage", () => {
  assert.equal(fs.existsSync(new URL("../.vercel/project.json", import.meta.url)), false);
  assert.doesNotMatch(activeConfiguration, /rawaj-saudi-classifieds/);
  assert.doesNotMatch(activeConfiguration, /https:\/\/sa\.rawa-j\.com/);
});

test("Syria frontend and API rewrites remain Syria-owned", () => {
  assert.match(environment, /^VITE_SITE_URL=https:\/\/rawa-j\.com$/m);
  assert.match(
    environment,
    /^VITE_PUBLIC_DATA_API_BASE_URL=https:\/\/rawaj-classifieds-hub\.allidamech\.workers\.dev$/m,
  );
  for (const rewrite of vercelConfig.rewrites ?? []) {
    assert.match(
      rewrite.destination,
      /^https:\/\/rawaj-classifieds-hub\.allidamech\.workers\.dev\//,
    );
  }
});
