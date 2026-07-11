import { createServerFileRoute } from "@tanstack/react-start/server";
import { getClient } from "@/lib/api/shared";
import { publicListingExpiryFilter } from "@/lib/api/listing-expiry";
import { absoluteUrl } from "@/lib/seo";

type SitemapEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: "hourly" | "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
};

type PublicListingSitemapRow = {
  id: string;
  owner_id: string;
  updated_at: string;
};

const staticEntries: SitemapEntry[] = [
  { loc: absoluteUrl("/"), changefreq: "daily", priority: 1 },
  { loc: absoluteUrl("/listings"), changefreq: "hourly", priority: 0.9 },
  { loc: absoluteUrl("/categories"), changefreq: "weekly", priority: 0.9 },
  { loc: absoluteUrl("/offers"), changefreq: "daily", priority: 0.8 },
  { loc: absoluteUrl("/safety"), changefreq: "monthly", priority: 0.5 },
  { loc: absoluteUrl("/prohibited"), changefreq: "monthly", priority: 0.4 },
  { loc: absoluteUrl("/privacy"), changefreq: "yearly", priority: 0.3 },
  { loc: absoluteUrl("/terms"), changefreq: "yearly", priority: 0.3 },
];

export const ServerRoute = createServerFileRoute("/sitemap.xml").methods({
  GET: async () => {
    const dynamicEntries = await readDynamicMarketplaceEntries();
    const xml = buildSitemapXml([...staticEntries, ...dynamicEntries]);

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control":
          "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
});

async function readDynamicMarketplaceEntries(): Promise<SitemapEntry[]> {
  const clientResult = getClient();
  if (!clientResult.ok) return [];

  const rows: PublicListingSitemapRow[] = [];
  const pageSize = 1000;
  const maxRows = 10_000;

  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const { data, error } = await clientResult.data
      .from("listings")
      .select("id,owner_id,updated_at")
      .eq("status", "approved")
      .is("archived_at", null)
      .or(publicListingExpiryFilter())
      .order("updated_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) return [];

    const page = (data ?? []) as PublicListingSitemapRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  const listingEntries: SitemapEntry[] = rows.map((row) => ({
    loc: absoluteUrl(`/listings/${encodeURIComponent(row.id)}`),
    lastmod: toIsoDate(row.updated_at),
    changefreq: "weekly",
    priority: 0.7,
  }));

  const sellerLastModified = new Map<string, string>();
  for (const row of rows) {
    const current = sellerLastModified.get(row.owner_id);
    if (!current || row.updated_at > current)
      sellerLastModified.set(row.owner_id, row.updated_at);
  }

  const sellerEntries: SitemapEntry[] = Array.from(
    sellerLastModified,
    ([ownerId, updatedAt]) => ({
      loc: absoluteUrl(`/seller/${encodeURIComponent(ownerId)}`),
      lastmod: toIsoDate(updatedAt),
      changefreq: "weekly",
      priority: 0.6,
    }),
  );

  return [...listingEntries, ...sellerEntries];
}

function buildSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((entry) => {
      const fields = [
        `<loc>${escapeXml(entry.loc)}</loc>`,
        entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "",
        entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : "",
        typeof entry.priority === "number"
          ? `<priority>${entry.priority.toFixed(1)}</priority>`
          : "",
      ]
        .filter(Boolean)
        .join("");
      return `<url>${fields}</url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

function toIsoDate(value: string): string | undefined {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? undefined
    : date.toISOString().slice(0, 10);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
