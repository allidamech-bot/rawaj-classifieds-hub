export type ImageInspection = {
  width: number;
  height: number;
  pixelCount: number;
  hasPrivacyMetadata: boolean;
};

export type ImageInspectionResult =
  | { ok: true; data: ImageInspection }
  | { ok: false; reason: "invalid_structure" | "dimensions_too_large" | "pixel_count_too_large" };

export type ImageSanitizationResult =
  | { ok: true; bytes: Uint8Array; removedMetadata: boolean }
  | { ok: false; reason: "invalid_structure" };

export const MAX_IMAGE_DIMENSION = 8_000;
export const MAX_IMAGE_PIXELS = 40_000_000;

const PNG_PRIVACY_CHUNKS = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
const JPEG_PRIVACY_MARKERS = new Set([0xe1, 0xed, 0xfe]);

export function inspectUploadedImage(
  bytes: Uint8Array,
  contentType: string,
): ImageInspectionResult {
  const parsed =
    contentType === "image/jpeg"
      ? inspectJpeg(bytes)
      : contentType === "image/png"
        ? inspectPng(bytes)
        : contentType === "image/webp"
          ? inspectWebp(bytes)
          : null;

  if (!parsed || parsed.width <= 0 || parsed.height <= 0) {
    return { ok: false, reason: "invalid_structure" };
  }
  if (parsed.width > MAX_IMAGE_DIMENSION || parsed.height > MAX_IMAGE_DIMENSION) {
    return { ok: false, reason: "dimensions_too_large" };
  }
  const pixelCount = parsed.width * parsed.height;
  if (!Number.isSafeInteger(pixelCount) || pixelCount > MAX_IMAGE_PIXELS) {
    return { ok: false, reason: "pixel_count_too_large" };
  }
  return { ok: true, data: { ...parsed, pixelCount } };
}

export function stripImagePrivacyMetadata(
  bytes: Uint8Array,
  contentType: string,
): ImageSanitizationResult {
  const sanitized =
    contentType === "image/jpeg"
      ? stripJpegMetadata(bytes)
      : contentType === "image/png"
        ? stripPngMetadata(bytes)
        : contentType === "image/webp"
          ? stripWebpMetadata(bytes)
          : null;

  return sanitized ?? { ok: false, reason: "invalid_structure" };
}

type ParsedImage = { width: number; height: number; hasPrivacyMetadata: boolean };

function inspectPng(bytes: Uint8Array): ParsedImage | null {
  if (bytes.length < 33 || !matches(bytes, 0, [137, 80, 78, 71, 13, 10, 26, 10])) return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let hasPrivacyMetadata = false;
  let sawIend = false;

  while (offset + 12 <= bytes.length) {
    const length = readUint32Be(bytes, offset);
    if (length === null || length > bytes.length - offset - 12) return null;
    const type = ascii(bytes, offset + 4, 4);
    const dataOffset = offset + 8;
    if (type === "IHDR") {
      if (length !== 13 || width || height) return null;
      width = readUint32Be(bytes, dataOffset) ?? 0;
      height = readUint32Be(bytes, dataOffset + 4) ?? 0;
    }
    if (PNG_PRIVACY_CHUNKS.has(type)) hasPrivacyMetadata = true;
    offset += 12 + length;
    if (type === "IEND") {
      if (length !== 0) return null;
      sawIend = true;
      break;
    }
  }

  return sawIend && width && height ? { width, height, hasPrivacyMetadata } : null;
}

function inspectJpeg(bytes: Uint8Array): ParsedImage | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  let width = 0;
  let height = 0;
  let hasPrivacyMetadata = false;

  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;
    const marker = bytes[offset++];
    if (marker === 0xd9) break;
    if (marker === 0xda) return width && height ? { width, height, hasPrivacyMetadata } : null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = readUint16Be(bytes, offset);
    if (length === null || length < 2 || offset + length > bytes.length) return null;

    if (JPEG_PRIVACY_MARKERS.has(marker)) hasPrivacyMetadata = true;
    if (isSofMarker(marker)) {
      if (length < 7) return null;
      height = readUint16Be(bytes, offset + 3) ?? 0;
      width = readUint16Be(bytes, offset + 5) ?? 0;
      if (!width || !height) return null;
    }
    offset += length;
  }

  return width && height ? { width, height, hasPrivacyMetadata } : null;
}

function inspectWebp(bytes: Uint8Array): ParsedImage | null {
  if (bytes.length < 20 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
    return null;
  }
  const declaredSize = readUint32Le(bytes, 4);
  if (declaredSize === null || declaredSize + 8 > bytes.length) return null;

  let offset = 12;
  let width = 0;
  let height = 0;
  let hasPrivacyMetadata = false;
  while (offset + 8 <= declaredSize + 8) {
    const type = ascii(bytes, offset, 4);
    const length = readUint32Le(bytes, offset + 4);
    if (length === null || length > declaredSize + 8 - offset - 8) return null;
    const dataOffset = offset + 8;
    if (type === "EXIF" || type === "XMP ") hasPrivacyMetadata = true;

    if (type === "VP8X" && length >= 10) {
      width = 1 + readUint24Le(bytes, dataOffset + 4);
      height = 1 + readUint24Le(bytes, dataOffset + 7);
    } else if (type === "VP8L" && length >= 5 && bytes[dataOffset] === 0x2f) {
      const b1 = bytes[dataOffset + 1];
      const b2 = bytes[dataOffset + 2];
      const b3 = bytes[dataOffset + 3];
      const b4 = bytes[dataOffset + 4];
      width = 1 + (b1 | ((b2 & 0x3f) << 8));
      height = 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10));
    } else if (
      type === "VP8 " &&
      length >= 10 &&
      matches(bytes, dataOffset + 3, [0x9d, 0x01, 0x2a])
    ) {
      width = (bytes[dataOffset + 6] | (bytes[dataOffset + 7] << 8)) & 0x3fff;
      height = (bytes[dataOffset + 8] | (bytes[dataOffset + 9] << 8)) & 0x3fff;
    }

    offset += 8 + length + (length % 2);
  }

  return width && height ? { width, height, hasPrivacyMetadata } : null;
}

function stripPngMetadata(bytes: Uint8Array): ImageSanitizationResult | null {
  if (!inspectPng(bytes)) return null;
  const parts: Uint8Array[] = [bytes.slice(0, 8)];
  let offset = 8;
  let removedMetadata = false;

  while (offset + 12 <= bytes.length) {
    const length = readUint32Be(bytes, offset);
    if (length === null || length > bytes.length - offset - 12) return null;
    const type = ascii(bytes, offset + 4, 4);
    const end = offset + 12 + length;
    if (PNG_PRIVACY_CHUNKS.has(type)) {
      removedMetadata = true;
    } else {
      parts.push(bytes.slice(offset, end));
    }
    offset = end;
    if (type === "IEND") break;
  }

  return { ok: true, bytes: concat(parts), removedMetadata };
}

function stripJpegMetadata(bytes: Uint8Array): ImageSanitizationResult | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const parts: Uint8Array[] = [bytes.slice(0, 2)];
  let offset = 2;
  let scanStart: number | null = null;
  let removedMetadata = false;
  let sawEoi = false;

  while (offset < bytes.length) {
    if (scanStart !== null) {
      const markerStart = findNextJpegMarker(bytes, offset);
      if (markerStart < 0) return null;
      parts.push(bytes.slice(scanStart, markerStart));
      offset = markerStart;
      scanStart = null;
    }

    if (offset + 1 >= bytes.length || bytes[offset] !== 0xff) return null;
    const markerStart = offset;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;
    const marker = bytes[offset++];

    if (marker === 0xd9) {
      parts.push(bytes.slice(markerStart, offset));
      sawEoi = true;
      break;
    }
    if (marker === 0x00) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(bytes.slice(markerStart, offset));
      continue;
    }
    if (offset + 2 > bytes.length) return null;
    const length = readUint16Be(bytes, offset);
    if (length === null || length < 2 || offset + length > bytes.length) return null;
    const segmentEnd = offset + length;

    if (JPEG_PRIVACY_MARKERS.has(marker)) {
      removedMetadata = true;
    } else {
      parts.push(bytes.slice(markerStart, segmentEnd));
    }
    offset = segmentEnd;
    if (marker === 0xda) scanStart = offset;
  }

  if (!sawEoi) return null;
  return { ok: true, bytes: concat(parts), removedMetadata };
}

function stripWebpMetadata(bytes: Uint8Array): ImageSanitizationResult | null {
  if (!inspectWebp(bytes)) return null;
  const declaredSize = readUint32Le(bytes, 4);
  if (declaredSize === null) return null;
  const riffEnd = declaredSize + 8;
  const chunks: Uint8Array[] = [];
  let offset = 12;
  let removedMetadata = false;

  while (offset + 8 <= riffEnd) {
    const type = ascii(bytes, offset, 4);
    const length = readUint32Le(bytes, offset + 4);
    if (length === null || length > riffEnd - offset - 8) return null;
    const end = offset + 8 + length + (length % 2);
    if (end > riffEnd) return null;

    if (type === "EXIF" || type === "XMP ") {
      removedMetadata = true;
    } else if (type === "VP8X" && length >= 10) {
      const chunk = bytes.slice(offset, end);
      chunk[8] &= ~0x0c;
      chunks.push(chunk);
    } else {
      chunks.push(bytes.slice(offset, end));
    }
    offset = end;
  }
  if (offset !== riffEnd) return null;

  const chunksLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(12 + chunksLength);
  output.set([82, 73, 70, 70], 0);
  writeUint32Le(output, 4, 4 + chunksLength);
  output.set([87, 69, 66, 80], 8);
  let writeOffset = 12;
  for (const chunk of chunks) {
    output.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  return { ok: true, bytes: output, removedMetadata };
}

function findNextJpegMarker(bytes: Uint8Array, start: number): number {
  let offset = start;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    let next = offset + 1;
    while (next < bytes.length && bytes[next] === 0xff) next += 1;
    if (next >= bytes.length) return -1;
    const marker = bytes[next];
    if (marker === 0x00) {
      offset = next + 1;
      continue;
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      offset = next + 1;
      continue;
    }
    return offset;
  }
  return -1;
}

function isSofMarker(marker: number): boolean {
  return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
    marker,
  );
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function matches(bytes: Uint8Array, offset: number, expected: number[]): boolean {
  if (offset < 0 || offset + expected.length > bytes.length) return false;
  return expected.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (offset < 0 || offset + length > bytes.length) return "";
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function readUint16Be(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32Be(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return (
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function readUint32Le(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return (
    bytes[offset] +
    (bytes[offset + 1] << 8) +
    (bytes[offset + 2] << 16) +
    bytes[offset + 3] * 0x1000000
  );
}

function readUint24Le(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 3 > bytes.length) return 0;
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function writeUint32Le(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}
