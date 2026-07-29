import { resolveLocationDescendantIds, searchLocationNodes } from "@/lib/api/location-taxonomy";

/**
 * Resolves a legacy visible location label through the canonical Cloudflare location index.
 * The retired client parameter is kept only to avoid breaking older call signatures.
 */
export async function resolveLocationSubtreeIds(
  _retiredClient: unknown,
  governorateId: string | undefined,
  locationLabel: string | undefined,
): Promise<string[]> {
  const label = locationLabel?.trim();
  if (!governorateId || !label) return [];
  if (label.startsWith("@")) {
    const result = await resolveLocationDescendantIds(label.slice(1));
    return result.ok ? result.data : [];
  }

  const search = await searchLocationNodes(label, 20);
  if (!search.ok) return [];
  const normalizedGovernorate = normalize(governorateId);
  const match = search.data.find(({ node, pathAr, pathEn }) => {
    const keys = [node.legacyGovernorateId, pathAr, pathEn].map(normalize).filter(Boolean);
    return keys.some((key) => key === normalizedGovernorate || key.includes(normalizedGovernorate));
  });
  if (!match) return [];
  const descendants = await resolveLocationDescendantIds(match.node.id);
  return descendants.ok && descendants.data.length > 0 ? descendants.data : [match.node.id];
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}
