const MAX_LISTING_IMAGE_DIMENSION = 2048;
const LISTING_IMAGE_QUALITY = 0.84;
const LISTING_IMAGE_SIGNATURE_BYTES = 16;

export type ListingImageMimeType = "image/jpeg" | "image/png" | "image/webp";

export interface ListingImageDimensions {
  width: number;
  height: number;
}

export interface ListingImageContentValidation {
  ok: boolean;
  detectedType?: ListingImageMimeType;
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

export async function detectListingImageMimeType(
  file: Blob,
): Promise<ListingImageMimeType | null> {
  const bytes = new Uint8Array(
    await file.slice(0, LISTING_IMAGE_SIGNATURE_BYTES).arrayBuffer(),
  );

  if (matchesBytes(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (matchesBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (
    matchesAscii(bytes, 0, "RIFF") &&
    matchesAscii(bytes, 8, "WEBP")
  ) {
    return "image/webp";
  }

  return null;
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

  if (file.type !== detectedType) {
    return {
      ok: false,
      detectedType,
      error: "نوع الصورة الحقيقي لا يطابق نوع الملف المعلن.",
    };
  }

  if (typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      if (bitmap.width <= 0 || bitmap.height <= 0) {
        return {
          ok: false,
          detectedType,
          error: "أبعاد الصورة غير صالحة.",
        };
      }
    } catch {
      return {
        ok: false,
        detectedType,
        error: "ملف الصورة تالف أو يتعذر فك ترميزه.",
      };
    } finally {
      bitmap?.close();
    }
  }

  return { ok: true, detectedType };
}

export async function prepareListingImageForUpload(file: File): Promise<File> {
  if (
    typeof document === "undefined" ||
    typeof createImageBitmap !== "function" ||
    !file.type.startsWith("image/")
  ) {
    return file;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const dimensions = fitListingImageDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);
    const blob = await canvasToBlob(canvas, "image/webp", LISTING_IMAGE_QUALITY);
    if (!blob || blob.size === 0) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "listing-image";
    return new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
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
