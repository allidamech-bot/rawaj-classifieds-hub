import assert from "node:assert/strict";
import test from "node:test";
import { validateSyriaProviderEnvironment } from "./syria-provider-preflight.mjs";

const validEnvironment = {
  VITE_SITE_URL: "https://rawa-j.com",
  VITE_PUBLIC_DATA_API_BASE_URL: "https://rawaj-classifieds-hub.allidamech.workers.dev",
  CLOUDFLARE_D1_DATABASE_ID: "123e4567-e89b-42d3-a456-426614174000",
  CLOUDFLARE_D1_DATABASE_NAME: "rawaj-production",
  CLOUDFLARE_R2_BUCKET_NAME: "rawaj-media-production",
  RAWAJ_WORKER_RELEASE_SHA: "a".repeat(40),
  VITE_SYRIA_FIREBASE_PROJECT_ID: "rawaj-syria-auth-production",
  SYRIA_FIREBASE_PROJECT_ID: "rawaj-syria-auth-production",
};

test("provider preflight accepts isolated Syria configuration", () => {
  assert.deepEqual(validateSyriaProviderEnvironment(validEnvironment), []);
});

test("provider preflight rejects empty and placeholder configuration", () => {
  assert.ok(validateSyriaProviderEnvironment({}).length >= 7);
  const errors = validateSyriaProviderEnvironment({
    ...validEnvironment,
    CLOUDFLARE_D1_DATABASE_ID: "00000000-0000-0000-0000-000000000000",
    VITE_SYRIA_FIREBASE_PROJECT_ID: "rawaj-syria-auth-pending",
    SYRIA_FIREBASE_PROJECT_ID: "rawaj-syria-auth-pending",
  });
  assert.ok(errors.some((error) => error.includes("local placeholder")));
  assert.ok(errors.some((error) => error.includes("dedicated Syria Firebase")));
});

test("provider preflight rejects cross-market and mismatched resources", () => {
  const foreignPrefix = `rawaj-${["sa", "udi"].join("")}`;
  const errors = validateSyriaProviderEnvironment({
    ...validEnvironment,
    VITE_SITE_URL: "https://sa.rawa-j.com",
    CLOUDFLARE_D1_DATABASE_NAME: `${foreignPrefix}-production`,
    CLOUDFLARE_R2_BUCKET_NAME: `${foreignPrefix}-media-production`,
    VITE_SYRIA_FIREBASE_PROJECT_ID: `${foreignPrefix}-auth-production`,
    SYRIA_FIREBASE_PROJECT_ID: "different-project",
  });

  assert.ok(errors.some((error) => error.includes("VITE_SITE_URL")));
  assert.ok(errors.some((error) => error.includes("another market resource")));
  assert.ok(errors.some((error) => error.includes("must match")));
  assert.ok(errors.some((error) => error.includes("dedicated Syria Firebase")));
});
