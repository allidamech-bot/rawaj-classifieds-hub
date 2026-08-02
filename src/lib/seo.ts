export const SITE_URL_ENV_NAME = "VITE_SITE_URL";

const fallbackSiteUrl = "https://sa.rawa-j.com";
const defaultTitle = "RAWAJ / رواج | سوق إعلانات مبوبة في السعودية";
const defaultDescription =
  "سوق إعلانات مبوبة في السعودية لبيع وشراء العقارات والسيارات والمنتجات والخدمات بطريقة آمنة ومنظمة.";
const defaultSocialImage = "/brand/rawaj-mark-transparent-512.png";
const siteName = "RAWAJ / رواج";

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
  const image = absoluteUrl(options.image || defaultSocialImage);

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: options.type ?? "website" },
      { property: "og:url", content: url },
      { property: "og:site_name", content: siteName },
      { property: "og:locale", content: "ar_SA" },
      { property: "og:locale:alternate", content: "en_US" },
      { property: "og:image", content: image },
      { property: "og:image:alt", content: `${title} — ${siteName}` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      { name: "twitter:image:alt", content: `${title} — ${siteName}` },
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
        name: siteName,
        url: absoluteUrl("/"),
        logo: absoluteUrl("/brand/rawaj-mark-transparent-192.png"),
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: siteName,
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

export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function jsonLdScript(data: unknown) {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: serializeJsonLd(data) },
  };
}