const MAX_LISTING_IMAGE_DIMENSION = 2048;
const LISTING_IMAGE_QUALITY = 0.84;
const LISTING_IMAGE_SIGNATURE_BYTES = 16;
const MAX_LISTING_IMAGE_SOURCE_DIMENSION = 12_000;
const MAX_LISTING_IMAGE_SOURCE_PIXELS = 50_000_000;

export type ListingImageMimeType = "image/jpeg" | "image/png" | "image/webp";

export interface ListingImageDimensions {
  width: number;
  height: number;
}

export interface ListingImageContentValidation {
  ok: boolean;
  detectedType?: ListingImageMimeType;
  dimensions?: ListingImageDimensions;
  error?: string;
}

export function fitListingImageDimensions(
  width: number,
  height: number,
  maxDimension = MAX_LISTING_IMAGE_DIMENSION,
): ListingImageDimensions {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Invalid image dimensions.");
  }

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function detectListingImageMimeType(file: Blob): Promise<ListingImageMimeType | null> {
  const bytes = new Uint8Array(await file.slice(0, LISTING_IMAGE_SIGNATURE_BYTES).arrayBuffer());

  if (matchesBytes(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (matchesBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (matchesAscii(bytes, 0, "RIFF") && matchesAscii(bytes, 8, "WEBP")) {
    return "image/webp";
  }

  return null;
}

export function normalizeListingImageFileMetadata(
  file: File,
  detectedType: ListingImageMimeType,
): File {
  const extension = extensionForMimeType(detectedType);
  const currentExtension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const extensionMatches =
    detectedType === "image/jpeg"
      ? currentExtension === "jpg" || currentExtension === "jpeg"
      : currentExtension === extension;

  if (file.type === detectedType && extensionMatches) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "listing-image";
  return new File([file], `${baseName}.${extension}`, {
    type: detectedType,
    lastModified: file.lastModified,
  });
}

export async function readListingImageDimensions(
  file: Blob,
  detectedType?: ListingImageMimeType,
): Promise<ListingImageDimensions | null> {
  const type = detectedType ?? (await detectListingImageMimeType(file));
  if (!type) return null;

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (type === "image/png") return readPngDimensions(bytes);
  if (type === "image/jpeg") return readJpegDimensions(bytes);
  return readWebpDimensions(bytes);
}

export async function validateListingImageContent(
  file: File,
): Promise<ListingImageContentValidation> {
  let detectedType: ListingImageMimeType | null;
  try {
    detectedType = await detectListingImageMimeType(file);
  } catch {
    return {
      ok: false,
      error: "تعذر قراءة محتوى الصورة. اختر ملف صورة آخر.",
    };
  }

  if (!detectedType) {
    return {
      ok: false,
      error: "محتوى الملف ليس صورة JPG أو PNG أو WebP صالحة.",
    };
  }

  const normalizedFile = normalizeListingImageFileMetadata(file, detectedType);

  let dimensions: ListingImageDimensions | null;
  try {
    dimensions = await readListingImageDimensions(normalizedFile, detectedType);
  } catch {
    dimensions = null;
  }

  if (!dimensions) {
    return {
      ok: false,
      detectedType,
      error: "تعذر قراءة أبعاد الصورة من محتوى الملف.",
    };
  }

  if (
    dimensions.width > MAX_LISTING_IMAGE_SOURCE_DIMENSION ||
    dimensions.height > MAX_LISTING_IMAGE_SOURCE_DIMENSION ||
    dimensions.width * dimensions.height > MAX_LISTING_IMAGE_SOURCE_PIXELS
  ) {
    return {
      ok: false,
      detectedType,
      dimensions,
      error: "أبعاد الصورة كبيرة جداً للمعالجة الآمنة. اختر صورة بدقة أقل.",
    };
  }

  if (typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(normalizedFile, { imageOrientation: "from-image" });
      if (bitmap.width <= 0 || bitmap.height <= 0) {
        return {
          ok: false,
          detectedType,
          dimensions,
          error: "أبعاد الصورة غير صالحة.",
        };
      }
    } catch {
      return {
        ok: false,
        detectedType,
        dimensions,
        error: "ملف الصورة تالف أو يتعذر فك ترميزه.",
      };
    } finally {
      bitmap?.close();
    }
  } else if (canUseImageElementDecoder()) {
    let objectUrl: string | null = null;
    try {
      const loaded = await loadListingImageElement(normalizedFile);
      objectUrl = loaded.objectUrl;
      if (loaded.image.naturalWidth <= 0 || loaded.image.naturalHeight <= 0) {
        return {
          ok: false,
          detectedType,
          dimensions,
          error: "أبعاد الصورة غير صالحة.",
        };
      }
    } catch {
      return {
        ok: false,
        detectedType,
        dimensions,
        error: "ملف الصورة تالف أو يتعذر فك ترميزه.",
      };
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  return { ok: true, detectedType, dimensions };
}

export async function prepareListingImageForUpload(file: File): Promise<File> {
  let detectedType: ListingImageMimeType | null = null;
  try {
    detectedType = await detectListingImageMimeType(file);
  } catch {
    return file;
  }
  if (!detectedType) return file;

  const normalizedFile = normalizeListingImageFileMetadata(file, detectedType);
  if (typeof document === "undefined") return normalizedFile;

  let bitmap: ImageBitmap | null = null;
  let image: HTMLImageElement | null = null;
  let objectUrl: string | null = null;

  try {
    let source: CanvasImageSource;
    let sourceWidth: number;
    let sourceHeight: number;

    if (typeof createImageBitmap === "function") {
      bitmap = await createImageBitmap(normalizedFile, { imageOrientation: "from-image" });
      source = bitmap;
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
    } else if (canUseImageElementDecoder()) {
      const loaded = await loadListingImageElement(normalizedFile);
      image = loaded.image;
      objectUrl = loaded.objectUrl;
      source = image;
      sourceWidth = image.naturalWidth;
      sourceHeight = image.naturalHeight;
    } else {
      return normalizedFile;
    }

    const dimensions = fitListingImageDimensions(sourceWidth, sourceHeight);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return normalizedFile;

    context.drawImage(source, 0, 0, dimensions.width, dimensions.height);
    const blob = await canvasToBlob(canvas, "image/webp", LISTING_IMAGE_QUALITY);
    if (!blob || blob.size === 0) return normalizedFile;

    const outputType = await detectListingImageMimeType(blob);
    if (!outputType) return normalizedFile;

    const baseName = normalizedFile.name.replace(/\.[^.]+$/, "") || "listing-image";
    return new File([blob], `${baseName}.${extensionForMimeType(outputType)}`, {
      type: outputType,
      lastModified: Date.now(),
    });
  } catch {
    return normalizedFile;
  } finally {
    bitmap?.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function readPngDimensions(bytes: Uint8Array): ListingImageDimensions | null {
  if (
    bytes.length < 24 ||
    !matchesBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ||
    !matchesAscii(bytes, 12, "IHDR")
  ) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return validDimensions(view.getUint32(16), view.getUint32(20));
}

function readJpegDimensions(bytes: Uint8Array): ListingImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;

    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 1 >= bytes.length) return null;

    const segmentLength = view.getUint16(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;

    if (isJpegStartOfFrame(marker)) {
      if (segmentLength < 7) return null;
      return validDimensions(view.getUint16(offset + 5), view.getUint16(offset + 3));
    }

    offset += segmentLength;
  }

  return null;
}

function readWebpDimensions(bytes: Uint8Array): ListingImageDimensions | null {
  if (bytes.length < 25 || !matchesAscii(bytes, 0, "RIFF") || !matchesAscii(bytes, 8, "WEBP")) {
    return null;
  }

  const chunkType = asciiAt(bytes, 12, 4);
  if (chunkType === "VP8X") {
    if (bytes.length < 30) return null;
    return validDimensions(readUint24Le(bytes, 24) + 1, readUint24Le(bytes, 27) + 1);
  }

  if (chunkType === "VP8 ") {
    if (bytes.length < 30 || bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      return null;
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return validDimensions(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff);
  }

  if (chunkType === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    const width = 1 + (bytes[21] | ((bytes[22] & 0x3f) << 8));
    const height = 1 + ((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10));
    return validDimensions(width, height);
  }

  return null;
}

function isJpegStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
}

function validDimensions(width: number, height: number): ListingImageDimensions | null {
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0
    ? { width, height }
    : null;
}

function extensionForMimeType(type: ListingImageMimeType): "jpg" | "png" | "webp" {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  return "webp";
}

function canUseImageElementDecoder(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function"
  );
}

function loadListingImageElement(
  file: File,
): Promise<{ image: HTMLImageElement; objectUrl: string }> {
  const objectUrl = URL.createObjectURL(file);
  const image = document.createElement("img");
  image.decoding = "async";

  return new Promise((resolve, reject) => {
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image_decode_failed"));
    };
    image.src = objectUrl;
  });
}

function readUint24Le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function matchesBytes(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function matchesAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  return Array.from(text).every(
    (character, index) => bytes[offset + index] === character.charCodeAt(0),
  );
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}
