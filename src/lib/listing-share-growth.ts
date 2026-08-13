import { absoluteUrl } from "@/lib/seo";

export const RAWAJ_LISTING_SUBMITTED_EVENT = "rawaj:listing-submitted";
const PENDING_SHARE_KEY = "rawaj.pending-listing-share.v1";
const GROWTH_ATTRIBUTION_KEY = "rawaj.growth-attribution.v1";
const PENDING_SHARE_TTL_MS = 24 * 60 * 60 * 1000;

export type ListingShareChannel = "native" | "whatsapp" | "copy" | "download";
export type ListingShareTemplateId =
  | "classic"
  | "quick-sale"
  | "minimal"
  | "emerald"
  | "premium"
  | "story";

export interface ListingShareTemplate {
  id: ListingShareTemplateId;
  labelAr: string;
  labelEn: string;
  format: "square" | "story";
  background: string;
  surface: string;
  foreground: string;
  muted: string;
  accent: string;
}

export const LISTING_SHARE_TEMPLATES: ListingShareTemplate[] = [
  {
    id: "classic",
    labelAr: "رواج كلاسيك",
    labelEn: "RAWAJ Classic",
    format: "square",
    background: "#122238",
    surface: "#F5F0E6",
    foreground: "#122238",
    muted: "#6B7280",
    accent: "#C99A43",
  },
  {
    id: "quick-sale",
    labelAr: "بيع سريع",
    labelEn: "Quick sale",
    format: "square",
    background: "#F4EEE2",
    surface: "#CC641A",
    foreground: "#21160F",
    muted: "#715D50",
    accent: "#CC641A",
  },
  {
    id: "minimal",
    labelAr: "هادئة",
    labelEn: "Minimal",
    format: "square",
    background: "#F7F4ED",
    surface: "#FFFFFF",
    foreground: "#182537",
    muted: "#667085",
    accent: "#182537",
  },
  {
    id: "emerald",
    labelAr: "زمردية",
    labelEn: "Emerald",
    format: "square",
    background: "#0C3B35",
    surface: "#F2F0E8",
    foreground: "#102B27",
    muted: "#667A75",
    accent: "#B49A62",
  },
  {
    id: "premium",
    labelAr: "فخمة",
    labelEn: "Premium",
    format: "square",
    background: "#242529",
    surface: "#ECE5D8",
    foreground: "#202126",
    muted: "#746E65",
    accent: "#B48A42",
  },
  {
    id: "story",
    labelAr: "ستوري",
    labelEn: "Story",
    format: "story",
    background: "#14263D",
    surface: "#F5F0E6",
    foreground: "#14263D",
    muted: "#667085",
    accent: "#C78A2D",
  },
];

export interface QueuedListingSharePrompt {
  listingId: string;
  queuedAt: number;
}

export interface GrowthAttributionTouch {
  source: string;
  medium: string | null;
  campaign: string | null;
  shareTemplate: string | null;
  listingId: string | null;
  landingPath: string;
  capturedAt: number;
}

export interface GrowthAttributionState {
  firstTouch: GrowthAttributionTouch;
  lastTouch: GrowthAttributionTouch;
}

export function queueListingSharePrompt(listingId: string): void {
  if (typeof window === "undefined" || !listingId.trim()) return;
  const detail: QueuedListingSharePrompt = { listingId: listingId.trim(), queuedAt: Date.now() };

  try {
    window.localStorage.setItem(PENDING_SHARE_KEY, JSON.stringify(detail));
  } catch {
    // The in-memory event still opens the prompt when storage is unavailable.
  }

  window.dispatchEvent(new CustomEvent(RAWAJ_LISTING_SUBMITTED_EVENT, { detail }));
}

export function readQueuedListingSharePrompt(): QueuedListingSharePrompt | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_SHARE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<QueuedListingSharePrompt>;
    if (
      typeof parsed.listingId !== "string" ||
      !parsed.listingId.trim() ||
      typeof parsed.queuedAt !== "number" ||
      Date.now() - parsed.queuedAt > PENDING_SHARE_TTL_MS
    ) {
      window.localStorage.removeItem(PENDING_SHARE_KEY);
      return null;
    }
    return { listingId: parsed.listingId, queuedAt: parsed.queuedAt };
  } catch {
    return null;
  }
}

export function clearQueuedListingSharePrompt(listingId?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (!listingId) {
      window.localStorage.removeItem(PENDING_SHARE_KEY);
      return;
    }
    const current = readQueuedListingSharePrompt();
    if (!current || current.listingId === listingId) {
      window.localStorage.removeItem(PENDING_SHARE_KEY);
    }
  } catch {
    // Dismissal must never block the user if storage is unavailable.
  }
}

export function buildListingShareUrl(
  listingId: string,
  channel: ListingShareChannel,
  templateId: ListingShareTemplateId,
): string {
  const url = new URL(absoluteUrl(`/listings/${encodeURIComponent(listingId)}`));
  url.searchParams.set("utm_source", "rawaj_share");
  url.searchParams.set("utm_medium", channel);
  url.searchParams.set("utm_campaign", "listing_share");
  url.searchParams.set("share_card", templateId);
  return url.toString();
}

export function captureGrowthAttribution(urlLike: string): GrowthAttributionState | null {
  if (typeof window === "undefined") return null;

  let url: URL;
  try {
    url = new URL(urlLike, window.location.origin);
  } catch {
    return null;
  }

  const source = url.searchParams.get("utm_source");
  if (source !== "rawaj_share") return readGrowthAttribution();

  const listingMatch = url.pathname.match(/^\/listings\/([^/]+)$/);
  const touch: GrowthAttributionTouch = {
    source,
    medium: url.searchParams.get("utm_medium"),
    campaign: url.searchParams.get("utm_campaign"),
    shareTemplate: url.searchParams.get("share_card"),
    listingId: listingMatch?.[1] ? decodeURIComponent(listingMatch[1]) : null,
    landingPath: `${url.pathname}${url.search}`,
    capturedAt: Date.now(),
  };

  const existing = readGrowthAttribution();
  const next: GrowthAttributionState = {
    firstTouch: existing?.firstTouch ?? touch,
    lastTouch: touch,
  };

  try {
    window.localStorage.setItem(GROWTH_ATTRIBUTION_KEY, JSON.stringify(next));
  } catch {
    // Attribution is best-effort and must never block navigation.
  }
  return next;
}

export function readGrowthAttribution(): GrowthAttributionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GROWTH_ATTRIBUTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GrowthAttributionState>;
    if (!parsed.firstTouch || !parsed.lastTouch) return null;
    return parsed as GrowthAttributionState;
  } catch {
    return null;
  }
}
