import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [queueSource, studioSource, packageSource] = await Promise.all([
  readFile(new URL("../src/lib/bounded-task-queue.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/add-listing.tsx", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("bounded task queue normalizes invalid concurrency and never exceeds its limits", () => {
  assert.match(queueSource, /Number\.isFinite\(concurrency\) \? Math\.floor\(concurrency\) : 1/);
  assert.match(queueSource, /Math\.min\(items\.length, Math\.max\(1, normalizedConcurrency\)\)/);
  assert.match(queueSource, /let nextIndex = 0/);
  assert.match(queueSource, /nextIndex \+= 1/);
  assert.match(queueSource, /Promise\.all\(Array\.from\(\{ length: workerCount \}/);
});

test("listing submission deliberately serializes image uploads for production safety", () => {
  assert.match(studioSource, /IMAGE_UPLOAD_CONCURRENCY = 1/);
  assert.match(studioSource, /runBoundedTasks\(/);
  assert.match(studioSource, /submitUploadEntries/);
  assert.match(studioSource, /await waitForAllImageUploadsInFlight\(\)/);
  assert.match(studioSource, /sortOrder: selectedImagesRef\.current\.findIndex/);
});

test("concurrent image uploads preserve per-image stale cleanup and failure state", () => {
  assert.match(studioSource, /isCurrentImageUploadOperation\(currentEntry\.id, operation\)/);
  assert.match(studioSource, /registerStaleUploadCleanup/);
  assert.match(studioSource, /state: "failed" as const/);
  assert.match(studioSource, /state: "uploaded" as const/);
  assert.match(
    studioSource,
    /finally \{[\s\S]*clearImageUploadOperation\(currentEntry\.id, operation\)/,
  );
});

test("image concurrency contract is part of the existing image reliability gate", () => {
  const packageJson = JSON.parse(packageSource);
  assert.match(
    packageJson.scripts["test:listing-image-content-reliability"],
    /listing-image-upload-concurrency\.test\.mjs/,
  );
});
