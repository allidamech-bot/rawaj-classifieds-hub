import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [processing, guardedUpload, retry, journal, apiBarrel] = await Promise.all([
  readFile(new URL("../src/lib/listing-image-processing.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-image-upload-guarded.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-image-upload-retry.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-image-upload-journal.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
]);

test("listing image content is verified by real file signatures", () => {
  assert.match(processing, /detectListingImageMimeType/);
  assert.match(processing, /0xff, 0xd8, 0xff/);
  assert.match(processing, /0x89, 0x50, 0x4e, 0x47/);
  assert.match(processing, /matchesAscii\(bytes, 0, "RIFF"\)/);
  assert.match(processing, /matchesAscii\(bytes, 8, "WEBP"\)/);
  assert.match(processing, /file\.type !== detectedType/);
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
    processing.indexOf("readListingImageDimensions(file, detectedType)") <
      processing.indexOf('createImageBitmap(file, { imageOrientation: "from-image" })'),
  );
});

test("oversized decoded dimensions are rejected before canvas allocation", () => {
  assert.match(processing, /MAX_LISTING_IMAGE_SOURCE_DIMENSION = 12_000/);
  assert.match(processing, /MAX_LISTING_IMAGE_SOURCE_PIXELS = 50_000_000/);
  assert.match(processing, /dimensions\.width \* dimensions\.height/);
  assert.match(processing, /أبعاد الصورة كبيرة جداً للمعالجة الآمنة/);
  assert.ok(
    processing.indexOf("dimensions.width > MAX_LISTING_IMAGE_SOURCE_DIMENSION") <
      processing.indexOf('createImageBitmap(file, { imageOrientation: "from-image" })'),
  );
});

test("decodable image content is checked before and after processing", () => {
  assert.match(processing, /validateListingImageContent/);
  assert.match(processing, /createImageBitmap\(file, \{ imageOrientation: "from-image" \}\)/);
  assert.match(processing, /ملف الصورة تالف أو يتعذر فك ترميزه/);
  assert.ok(
    guardedUpload.indexOf("validateListingImageContent(file)") <
      guardedUpload.indexOf("prepareListingImageForUpload(file)"),
  );
  assert.ok(
    guardedUpload.indexOf("prepareListingImageForUpload(file)") <
      guardedUpload.indexOf("validateListingImageContent(preparedFile)"),
  );
});

test("transient storage failures receive bounded exponential retries", () => {
  assert.match(retry, /DEFAULT_MAX_ATTEMPTS = 3/);
  assert.match(retry, /status === 408/);
  assert.match(retry, /status === 429/);
  assert.match(retry, /status !== null && status >= 500/);
  assert.match(retry, /baseDelayMs \* 2 \*\* \(attempt - 1\)/);
  assert.match(guardedUpload, /uploadListingImageObjectWithRetry/);
  assert.match(guardedUpload, /mapStorageError/);
});

test("unfinished storage writes survive navigation in a bounded browser journal", () => {
  assert.match(journal, /rawaj:listing-image-upload-journal:v1/);
  assert.match(journal, /DEFAULT_ORPHAN_MIN_AGE_MS = 15 \* 60 \* 1000/);
  assert.match(journal, /MAX_JOURNAL_RECORDS = 50/);
  assert.match(journal, /typeof window === "undefined"/);
  assert.match(journal, /window\.localStorage/);
  assert.match(journal, /isOwnedListingImagePath/);
  assert.match(journal, /activeListingImageUploads\.add\(storagePath\)/);
  assert.match(journal, /!activeListingImageUploads\.has\(record\.storagePath\)/);
  assert.match(
    guardedUpload,
    /rememberPendingListingImageUpload\(userId, listing\.id, storagePath\)/,
  );
});

test("orphan cleanup verifies database references before deleting storage objects", () => {
  assert.match(journal, /\.from\("listing_images"\)/);
  assert.match(journal, /\.select\("storage_path"\)/);
  assert.match(journal, /\.in\("storage_path", candidatePaths\)/);
  assert.ok(journal.indexOf('.from("listing_images")') < journal.indexOf(".remove(orphanPaths)"));
  assert.match(journal, /\.from\(listingImagesBucket\)/);
  assert.match(journal, /\.remove\(orphanPaths\)/);
  assert.match(journal, /const clearedPaths = new Set\(referencedPaths\)/);
});

test("upload journal clears only after a database link or confirmed storage cleanup", () => {
  assert.match(guardedUpload, /cleanupPendingListingImageUploads\(userId\)/);
  assert.match(guardedUpload, /if \(!orphanCleanup\.ok\)/);
  assert.match(
    guardedUpload,
    /if \(removeResult\.error\) releasePendingListingImageUpload\(storagePath\);/,
  );
  assert.match(guardedUpload, /else clearPendingListingImageUpload\(storagePath\);/);
  assert.match(guardedUpload, /releasePendingListingImageUpload\(storagePath\)/);
  assert.ok(
    guardedUpload.indexOf(".insert({") <
      guardedUpload.lastIndexOf("clearPendingListingImageUpload(storagePath)"),
  );
});

test("public classifieds API routes uploads through the guarded image pipeline", () => {
  assert.match(
    apiBarrel,
    /export \{ uploadListingImage \} from "@\/lib\/api\/listing-image-upload-guarded"/,
  );
});
