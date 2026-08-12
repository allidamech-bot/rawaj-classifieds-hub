export const listingImagesBucket = "listing-images";
export const profileMediaBucket = "profile-media";
export const adPlacementMediaBucket = "ad-placement-media";
export const promotionReceiptsBucket = "promotion-receipts";

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_PROFILE_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;
const MAX_AD_PLACEMENT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_RECEIPT_SIZE_BYTES = 8 * 1024 * 1024;

export const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const allowedReceiptTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export function validateImageMimeType(mimeType: string): boolean {
  return allowedImageTypes.includes(mimeType as (typeof allowedImageTypes)[number]);
}

export function validateReceiptMimeType(mimeType: string): boolean {
  return allowedReceiptTypes.includes(mimeType as (typeof allowedReceiptTypes)[number]);
}

export function validateImageExtension(filename: string): boolean {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension ? ["jpg", "jpeg", "png", "webp"].includes(extension) : false;
}

export function validateReceiptExtension(filename: string): boolean {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension ? ["jpg", "jpeg", "png", "webp", "pdf"].includes(extension) : false;
}

export function validateImageFile(file: File): { ok: boolean; error?: string } {
  if (file.size <= 0) {
    return { ok: false, error: "ملف الصورة فارغ أو تالف." };
  }
  if (!validateImageMimeType(file.type)) {
    return { ok: false, error: "الصيغ المسموحة للصور: JPG أو PNG أو WebP." };
  }
  if (!validateImageExtension(file.name)) {
    return {
      ok: false,
      error: "امتداد الملف غير صالح. استخدم jpg أو png أو webp.",
    };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { ok: false, error: "حجم الصورة يجب ألا يتجاوز 8MB." };
  }
  return { ok: true };
}

export function validateReceiptFile(file: File): {
  ok: boolean;
  error?: string;
} {
  if (file.size <= 0) {
    return { ok: false, error: "ملف الإيصال فارغ أو تالف." };
  }
  if (!validateReceiptMimeType(file.type)) {
    return {
      ok: false,
      error: "الصيغ المسموحة للإيصال: JPG أو PNG أو WebP أو PDF.",
    };
  }
  if (!validateReceiptExtension(file.name)) {
    return {
      ok: false,
      error: "امتداد الملف غير صالح. استخدم jpg أو png أو webp أو pdf.",
    };
  }
  if (file.size > MAX_RECEIPT_SIZE_BYTES) {
    return { ok: false, error: "حجم الإيصال يجب ألا يتجاوز 8MB." };
  }
  return { ok: true };
}

export function validateProfileImageFile(file: File): {
  ok: boolean;
  error?: string;
} {
  if (file.size <= 0) {
    return { ok: false, error: "ملف صورة الحساب فارغ أو تالف." };
  }
  if (!validateImageMimeType(file.type)) {
    return { ok: false, error: "الصيغ المسموحة للصور: JPG أو PNG أو WebP." };
  }
  if (!validateImageExtension(file.name)) {
    return {
      ok: false,
      error: "امتداد الملف غير صالح. استخدم jpg أو png أو webp.",
    };
  }
  if (file.size > MAX_PROFILE_IMAGE_SIZE_BYTES) {
    return { ok: false, error: "حجم صورة الملف يجب ألا يتجاوز 3MB." };
  }
  return { ok: true };
}

function normalizedImageExtension(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension && ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
}

export function buildListingImagePath(userId: string, listingId: string, filename: string): string {
  return `${userId}/${listingId}/${crypto.randomUUID()}.${normalizedImageExtension(filename)}`;
}

export function buildProfileMediaPath(userId: string, kind: string, filename: string): string {
  return `${userId}/${kind}/${crypto.randomUUID()}.${normalizedImageExtension(filename)}`;
}

export function buildAdPlacementMediaPath(userId: string, filename: string): string {
  return `${userId}/${crypto.randomUUID()}.${normalizedImageExtension(filename)}`;
}

export function buildPromotionReceiptPath(
  userId: string,
  requestId: string,
  filename: string,
): string {
  const safeExtension = filename.split(".").pop()?.toLowerCase();
  const normalizedExtension =
    safeExtension && ["jpg", "jpeg", "png", "webp", "pdf"].includes(safeExtension)
      ? safeExtension
      : "jpg";
  return `${userId}/${requestId}/${crypto.randomUUID()}.${normalizedExtension}`;
}

export function isPathOwnedByUser(path: string, userId: string, kind: string): boolean {
  return path.startsWith(`${userId}/${kind}/`);
}

export const AD_PLACEMENT_IMAGE_MIN_WIDTH = 960;
export const AD_PLACEMENT_IMAGE_MIN_HEIGHT = 420;
export const AD_PLACEMENT_IMAGE_RATIO = 16 / 7;

export interface AdPlacementImageValidation {
  ok: boolean;
  error?: string;
  width?: number;
  height?: number;
}

export function validateAdPlacementImageFile(file: File): { ok: boolean; error?: string } {
  if (file.size <= 0) return { ok: false, error: "ملف الصورة فارغ أو تالف." };
  if (!validateImageMimeType(file.type)) {
    return { ok: false, error: "الصيغ المسموحة للصور: JPG أو PNG أو WebP." };
  }
  if (!validateImageExtension(file.name)) {
    return { ok: false, error: "امتداد الملف غير صالح. استخدم jpg أو png أو webp." };
  }
  if (file.size > MAX_AD_PLACEMENT_IMAGE_SIZE_BYTES) {
    return { ok: false, error: "حجم صورة المساحة يجب ألا يتجاوز 5MB." };
  }
  return { ok: true };
}

export function validateAdPlacementImageDimensions(
  width: number,
  height: number,
): AdPlacementImageValidation {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { ok: false, error: "تعذر قراءة أبعاد الصورة.", width, height };
  }
  if (width < AD_PLACEMENT_IMAGE_MIN_WIDTH || height < AD_PLACEMENT_IMAGE_MIN_HEIGHT) {
    return {
      ok: false,
      error: "الصورة صغيرة جداً لإنتاج إعلان واضح. استخدم صورة لا تقل عن 960×420 بكسل.",
      width,
      height,
    };
  }
  return { ok: true, width, height };
}

export function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dimensions);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("تعذر قراءة أبعاد الصورة."));
    };
    image.src = url;
  });
}
