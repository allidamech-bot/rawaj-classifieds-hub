import { adPlacementMediaBucket } from "@/lib/api/storage";

const publicObjectPrefix = `/storage/v1/object/public/${adPlacementMediaBucket}/`;
const privateObjectPrefix = `/storage/v1/object/${adPlacementMediaBucket}/`;

export function normalizeAdPlacementMediaUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    if (url.pathname.includes(publicObjectPrefix)) return url.toString();
    if (url.pathname.includes(privateObjectPrefix)) {
      url.pathname = url.pathname.replace(privateObjectPrefix, publicObjectPrefix);
      return url.toString();
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}
