import { createFileRoute } from "@tanstack/react-router";
import {
  fetchCloudflareSitemapCount,
  fetchCloudflareSitemapListings,
  fetchCloudflareSitemapReferences,
} from "@/lib/public-data/cloudflare-client";
import { absoluteUrl } from "@/lib/seo";

type SitemapEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: "hourly" | "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
};

type SitemapIndexEntry = {
  loc: string;
  lastmod?: string;
};

const SITEMAP_PAGE_SIZE = 1_000;
const SITEMAP_SECTION_STATIC = "static";
const SITEMAP_SECTION_MARKETPLACE = "marketplace";

const staticEntries: SitemapEntry[] = [
  { loc: absoluteUrl("/"), changefreq: "daily", priority: 1 },
  { loc: absoluteUrl("/listings"), changefreq: "hourly", priority: 0.9 },
  { loc: absoluteUrl("/categories"), changefreq: "weekly", priority: 0.9 },
  { loc: absoluteUrl("/offers"), changefreq: "daily", priority: 0.8 },
  { loc: absoluteUrl("/safety"), changefreq: "monthly", priority: 0.5 },
  { loc: absoluteUrl("/prohibited"), changefreq: "monthly", priority: 0.4 },
  { loc: absoluteUrl("/support"), changefreq: "monthly", priority: 0.4 },
  { loc: absoluteUrl("/privacy"), changefreq: "yearly", priority: 0.3 },
  { loc: absoluteUrl("/terms"), changefreq: "yearly", priority: 0.3 },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const requestUrl = new URL(request.url);
          const section = requestUrl.searchParams.get("section");
          const page = parsePage(requestUrl.searchParams.get("page"));

          if (section === SITEMAP_SECTION_STATIC) {
            if (page !== 1) return sitemapNotFound();
            const entries = [...staticEntries, ...(await readPublicReferenceEntries())];
            return xmlResponse(buildSitemapXml(entries));
          }

          if (section === SITEMAP_SECTION_MARKETPLACE) {
            const entries = await readMarketplacePage(page);
            if (entries.length === 0 && page > 1) return sitemapNotFound();
            return xmlResponse(buildSitemapXml(entries));
          }

          if (section) return sitemapNotFound();

          const listingCount = await readPublicListingCount();
          const marketplacePageCount = Math.ceil(listingCount / SITEMAP_PAGE_SIZE);
          const today = new Date().toISOString().slice(0, 10);
          const indexEntries: SitemapIndexEntry[] = [
            {
              loc: sitemapShardUrl(SITEMAP_SECTION_STATIC, 1),
              lastmod: today,
            },
            ...Array.from({ length: marketplacePageCount }, (_, index) => ({
              loc: sitemapShardUrl(SITEMAP_SECTION_MARKETPLACE, index + 1),
              lastmod: today,
            })),
          ];

          return xmlResponse(buildSitemapIndexXml(indexEntries));
        } catch (error) {
          console.error(
            JSON.stringify({
              event: "public_sitemap_render_failed",
              message: error instanceof Error ? error.message : String(error),
            }),
          );
          return new Response("Sitemap temporarily unavailable", {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-store",
              "Retry-After": "300",
              "X-Content-Type-Options": "nosniff",
            },
          });
        }
      },
    },
  },
});

async function readPublicReferenceEntries(): Promise<SitemapEntry[]> {
  const result = await fetchCloudflareSitemapReferences();
  if (!result.ok) throw new Error(result.error.message);

  const categoryEntries: SitemapEntry[] = result.data.categories
    .filter((row) => row.slug)
    .map((row) => ({
      loc: absoluteUrl(`/category/${encodeURIComponent(row.slug)}`),
      changefreq: "daily",
      priority: 0.8,
    }));
  const governorateEntries: SitemapEntry[] = result.data.governorates
    .filter((row) => row.slug)
    .map((row) => ({
      loc: absoluteUrl(`/syria/${encodeURIComponent(row.slug)}`),
      changefreq: "daily",
      priority: 0.8,
    }));
  return [...categoryEntries, ...governorateEntries];
}

async function readPublicListingCount(): Promise<number> {
  const result = await fetchCloudflareSitemapCount();
  if (!result.ok) throw new Error(result.error.message);
  return result.data.count;
}

async function readMarketplacePage(page: number): Promise<SitemapEntry[]> {
  const result = await fetchCloudflareSitemapListings(page, SITEMAP_PAGE_SIZE);
  if (!result.ok) throw new Error(result.error.message);
  const rows = result.data;
  const listingEntries: SitemapEntry[] = rows.map((row) => ({
    loc: absoluteUrl(`/listings/${encodeURIComponent(row.id)}`),
    lastmod: toIsoDate(row.updatedAt),
    changefreq: "weekly",
    priority: 0.7,
  }));
  const sellerLastModified = new Map<string, string>();
  for (const row of rows) {
    const current = sellerLastModified.get(row.ownerId);
    if (!current || row.updatedAt > current) sellerLastModified.set(row.ownerId, row.updatedAt);
  }
  const sellerEntries: SitemapEntry[] = Array.from(sellerLastModified, ([ownerId, updatedAt]) => ({
    loc: absoluteUrl(`/seller/${encodeURIComponent(ownerId)}`),
    lastmod: toIsoDate(updatedAt),
    changefreq: "weekly",
    priority: 0.6,
  }));
  return [...listingEntries, ...sellerEntries];
}

function sitemapShardUrl(section: string, page: number): string {
  return absoluteUrl(`/sitemap.xml?section=${encodeURIComponent(section)}&page=${page}`);
}

function parsePage(value: string | null): number {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function sitemapNotFound(): Response {
  return new Response(buildSitemapXml([]), {
    status: 404,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function buildSitemapIndexXml(entries: SitemapIndexEntry[]): string {
  const sitemaps = entries
    .map((entry) => {
      const fields = [
        `<loc>${escapeXml(entry.loc)}</loc>`,
        entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "",
      ]
        .filter(Boolean)
        .join("");
      return `<sitemap>${fields}</sitemap>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemaps}</sitemapindex>`;
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
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
