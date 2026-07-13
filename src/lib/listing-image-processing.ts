const MAX_LISTING_IMAGE_DIMENSION = 2048;
const LISTING_IMAGE_QUALITY = 0.84;

export interface ListingImageDimensions {
  width: number;
  height: number;
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

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}
