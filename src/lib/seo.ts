export const SITE_URL_ENV_NAME = "VITE_SITE_URL";

const fallbackSiteUrl = "https://rawa-j.com";
const defaultTitle = "RAWAJ / رواج | سوق إعلانات مبوبة في سوريا";
const defaultDescription =
  "سوق إعلانات مبوبة في سوريا لبيع وشراء العقارات والسيارات والمنتجات والخدمات بطريقة آمنة ومنظمة.";

type OgType = "website" | "article" | "profile";

type SeoOptions = {
  title?: string;
  description?: string;
  path?: string;
  type?: OgType;
  image?: string | null;
  noindex?: boolean;
};

export type BreadcrumbItem = {
  name: string;
  path: string;
};

export function getSiteUrl() {
  const configured = (import.meta.env[SITE_URL_ENV_NAME] as string | undefined)?.trim();
  return (configured || fallbackSiteUrl).replace(/\/+$/, "");
}

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

export function plainText(value: string | null | undefined, maxLength = 160) {
  const clean = (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}…`;
}

export function createSeo(options: SeoOptions = {}) {
  const title = options.title?.trim() || defaultTitle;
  const description = plainText(options.description || defaultDescription);
  const url = absoluteUrl(options.path ?? "/");
  const image = options.image ? absoluteUrl(options.image) : null;
  const twitterCard = image ? "summary_large_image" : "summary";

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: options.type ?? "website" },
      { property: "og:url", content: url },
      ...(image ? [{ property: "og:image", content: image }] : []),
      { name: "twitter:card", content: twitterCard },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      ...(image ? [{ name: "twitter:image", content: image }] : []),
      ...(options.noindex ? [{ name: "robots", content: "noindex, nofollow" }] : []),
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

export function buildSiteStructuredData() {
  const organizationId = absoluteUrl("/#organization");
  const websiteId = absoluteUrl("/#website");

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "RAWAJ / رواج",
        url: absoluteUrl("/"),
        logo: absoluteUrl("/brand/rawaj-mark-transparent-192.png"),
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: "RAWAJ / رواج",
        url: absoluteUrl("/"),
        inLanguage: ["ar", "en"],
        publisher: { "@id": organizationId },
        potentialAction: {
          "@type": "SearchAction",
          target: `${absoluteUrl("/listings")}?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

export function buildBreadcrumbStructuredData(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: plainText(item.name, 120),
      item: absoluteUrl(item.path),
    })),
  };
}

export function jsonLdScript(data: unknown) {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(data) },
  };
}
