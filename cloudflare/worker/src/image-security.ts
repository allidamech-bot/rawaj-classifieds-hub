export type ImageInspection = {
  width: number;
  height: number;
  pixelCount: number;
  hasPrivacyMetadata: boolean;
};

export type ImageInspectionResult =
  | { ok: true; data: ImageInspection }
  | { ok: false; reason: "invalid_structure" | "dimensions_too_large" | "pixel_count_too_large" };

export const MAX_IMAGE_DIMENSION = 8_000;
export const MAX_IMAGE_PIXELS = 40_000_000;

export function inspectUploadedImage(bytes: Uint8Array, contentType: string): ImageInspectionResult {
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
    if (["eXIf", "tEXt", "zTXt", "iTXt"].includes(type)) hasPrivacyMetadata = true;
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

    if (marker === 0xe1 || marker === 0xed || marker === 0xfe) hasPrivacyMetadata = true;
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
  if (
    bytes.length < 20 ||
    ascii(bytes, 0, 4) !== "RIFF" ||
    ascii(bytes, 8, 4) !== "WEBP"
  ) {
    return null;
  }
  const declaredSize = readUint32Le(bytes, 4);
  if (declaredSize === null || declaredSize + 8 > bytes.length) return null;

  let offset = 12;
  let width = 0;
  let height = 0;
  let hasPrivacyMetadata = false;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4);
    const length = readUint32Le(bytes, offset + 4);
    if (length === null || length > bytes.length - offset - 8) return null;
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

function isSofMarker(marker: number): boolean {
  return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
    marker,
  );
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
