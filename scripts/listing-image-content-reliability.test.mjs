import assert from "node:assert/strict";
import { File } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const [
  processing,
  guardedUpload,
  retry,
  journal,
  apiBarrel,
  listingsClient,
  addListing,
  marketplaceWorker,
] = await Promise.all([
  readFile(new URL("../src/lib/listing-image-processing.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-image-upload-guarded.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-image-upload-retry.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-image-upload-journal.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listings.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/add-listing.tsx", import.meta.url), "utf8"),
  readFile(new URL("../cloudflare/worker/src/marketplace-private.ts", import.meta.url), "utf8"),
]);

async function importTypeScriptModule(source) {
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`);
}

test("listing image content is verified by real file signatures", () => {
  assert.match(processing, /detectListingImageMimeType/);
  assert.match(processing, /0xff, 0xd8, 0xff/);
  assert.match(processing, /0x89, 0x50, 0x4e, 0x47/);
  assert.match(processing, /matchesAscii\(bytes, 0, "RIFF"\)/);
  assert.match(processing, /matchesAscii\(bytes, 8, "WEBP"\)/);
  assert.match(processing, /normalizeListingImageFileMetadata/);
  assert.doesNotMatch(processing, /file\.type !== detectedType/);
});

test("mislabeled iOS and generated images are normalized to their real safe type", async () => {
  const processingModule = await importTypeScriptModule(processing);
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 640);
  view.setUint32(20, 480);

  const mislabeled = new File([bytes], "generated-image.jpeg", {
    type: "image/jpeg",
    lastModified: 123,
  });
  const validation = await processingModule.validateListingImageContent(mislabeled);
  assert.deepEqual(validation, {
    ok: true,
    detectedType: "image/png",
    dimensions: { width: 640, height: 480 },
  });

  const prepared = await processingModule.prepareListingImageForUpload(mislabeled);
  assert.equal(prepared.name, "generated-image.png");
  assert.equal(prepared.type, "image/png");
  assert.equal(prepared.lastModified, 123);
  assert.equal(prepared.size, bytes.length);
});

test("source dimensions are parsed from JPG, PNG, and WebP headers before decoding", () => {
  assert.match(processing, /readListingImageDimensions/);
  assert.match(processing, /readPngDimensions/);
  assert.match(processing, /matchesAscii\(bytes, 12, "IHDR"\)/);
  assert.match(processing, /view\.getUint32\(16\)/);
  assert.match(processing, /readJpegDimensions/);
  assert.match(processing, /isJpegStartOfFrame/);
  assert.match(processing, /view\.getUint16\(offset \+ 5\)/);
  assert.match(processing, /readWebpDimensions/);
  assert.match(processing, /chunkType === "VP8X"/);
  assert.match(processing, /chunkType === "VP8 "/);
  assert.match(processing, /chunkType === "VP8L"/);
  assert.ok(
    processing.indexOf("readListingImageDimensions(normalizedFile, detectedType)") <
      processing.indexOf('createImageBitmap(normalizedFile, { imageOrientation: "from-image" })'),
  );
});

test("oversized decoded dimensions are rejected before canvas allocation", () => {
  assert.match(processing, /MAX_LISTING_IMAGE_SOURCE_DIMENSION = 12_000/);
  assert.match(processing, /MAX_LISTING_IMAGE_SOURCE_PIXELS = 50_000_000/);
  assert.match(processing, /dimensions\.width \* dimensions\.height/);
  assert.ok(
    processing.indexOf("dimensions.width > MAX_LISTING_IMAGE_SOURCE_DIMENSION") <
      processing.indexOf('createImageBitmap(normalizedFile, { imageOrientation: "from-image" })'),
  );
});

test("client validates decodable content before and after image preparation", () => {
  const firstValidation = listingsClient.indexOf("validateListingImageContent(file)");
  const preparation = listingsClient.indexOf("prepareListingImageForUpload(file)");
  const preparedValidation = listingsClient.indexOf("validateListingImageContent(prepared)");

  assert.match(processing, /validateListingImageContent/);
  assert.match(
    processing,
    /createImageBitmap\(normalizedFile, \{ imageOrientation: "from-image" \}\)/,
  );
  assert.match(processing, /loadListingImageElement\(normalizedFile\)/);
  assert.ok(firstValidation >= 0);
  assert.ok(firstValidation < preparation);
  assert.ok(preparation < preparedValidation);
});

test("transient upload retry helper is behaviorally bounded with exponential delays", async () => {
  const retryModule = await importTypeScriptModule(retry);
  const waits = [];
  let attempts = 0;
  const result = await retryModule.uploadListingImageObjectWithRetry(
    async () => {
      attempts += 1;
      return { error: { status: 503, message: "temporarily unavailable" } };
    },
    {
      wait: async (delayMs) => {
        waits.push(delayMs);
      },
    },
  );

  assert.equal(attempts, 3);
  assert.deepEqual(waits, [300, 600]);
  assert.equal(result.error.status, 503);
  assert.match(retry, /Math\.min\(options\.maxAttempts \?\? DEFAULT_MAX_ATTEMPTS, 5\)/);
});

test("the browser upload path is Cloudflare-only and has no Supabase storage fallback", () => {
  assert.match(listingsClient, /`\/v1\/listings\/\$\{encodeURIComponent\(listing\.id\)\}\/images`/);
  assert.match(guardedUpload, /return uploadListingImageCloudflare\(payload\)/);
  assert.doesNotMatch(
    `${guardedUpload}\n${listingsClient}\n${journal}`,
    /@supabase|createClient|\.from\(["']|\.storage\.|getPublicUrl|createSignedUrl/i,
  );
});

test("Worker enforces ownership, MIME/signature checks, then links R2 and D1 metadata", () => {
  assert.match(marketplaceWorker, /listing\.owner_id !== auth\.userId/);
  assert.match(marketplaceWorker, /IMAGE_TYPES\.has\(file\.type\)/);
  assert.match(marketplaceWorker, /matchesImageSignature\(bytes, file\.type\)/);
  assert.match(marketplaceWorker, /env\.MEDIA\.put\(objectKey, bytes\.buffer/);
  assert.match(marketplaceWorker, /INSERT INTO media_assets/);
  assert.match(marketplaceWorker, /INSERT INTO listing_images/);
  assert.ok(
    marketplaceWorker.indexOf("matchesImageSignature(bytes, file.type)") <
      marketplaceWorker.indexOf("env.MEDIA.put(objectKey, bytes.buffer"),
  );
});

test("Worker deletes a newly written R2 object when its D1 link fails", () => {
  const failedBatchCheck = marketplaceWorker.indexOf("results.some((result) => !result.success)");
  const cleanup = marketplaceWorker.indexOf("await env.MEDIA.delete(objectKey)", failedBatchCheck);
  assert.ok(failedBatchCheck >= 0);
  assert.ok(cleanup > failedBatchCheck);
  assert.ok(cleanup < marketplaceWorker.indexOf("return databaseError(cors)", failedBatchCheck));
});

test("removed in-flight images use the current Worker delete API for stale cleanup", () => {
  assert.match(addListing, /registerStaleUploadCleanup/);
  assert.match(addListing, /runStaleUploadCleanup/);
  assert.match(addListing, /deleteListingImage\(record\.userId, record\.draftId/);
  assert.match(addListing, /await awaitStaleUploadCleanups\(listingDraft\.id\)/);
  assert.match(listingsClient, /`\/v1\/listing-images\/\$\{encodeURIComponent\(image\.id\)\}`/);
});

test("retired browser upload journal is only cleared and never contacts storage or a database", () => {
  assert.match(journal, /rawaj:listing-image-upload-journal:v1/);
  assert.match(journal, /window\.localStorage\.removeItem\(JOURNAL_STORAGE_KEY\)/);
  assert.match(journal, /removed: 0, referenced: 0, pending: 0/);
  assert.doesNotMatch(journal, /\.setItem\(|\.from\(|\.remove\(|supabase|listingImagesBucket/i);
});

test("public classifieds API routes uploads through the guarded Cloudflare pipeline", () => {
  assert.match(
    apiBarrel,
    /export \{ uploadListingImage \} from "@\/lib\/api\/listing-image-upload-guarded"/,
  );
});
