import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [processing, guardedUpload, retry, apiBarrel] = await Promise.all([
  readFile(new URL("../src/lib/listing-image-processing.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-image-upload-guarded.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-image-upload-retry.ts", import.meta.url), "utf8"),
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

test("public classifieds API routes uploads through the guarded image pipeline", () => {
  assert.match(
    apiBarrel,
    /export \{ uploadListingImage \} from "@\/lib\/api\/listing-image-upload-guarded"/,
  );
});
