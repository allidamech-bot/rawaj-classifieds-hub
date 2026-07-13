from pathlib import Path

path = Path("src/routes/listings.$id.tsx")
text = path.read_text()

old_import = '''import { listingLocationDisplay } from "@/lib/listing-location-display";
import {
  absoluteUrl,
  buildBreadcrumbStructuredData,
  createSeo,
  jsonLdScript,
  plainText,
} from "@/lib/seo";'''
new_import = '''import { listingLocationDisplay } from "@/lib/listing-location-display";
import { buildListingStructuredData } from "@/lib/listing-structured-data";
import {
  buildBreadcrumbStructuredData,
  createSeo,
  jsonLdScript,
  plainText,
} from "@/lib/seo";'''
if old_import not in text:
    raise SystemExit("semantic SEO import block not found")
text = text.replace(old_import, new_import, 1)

old_function = '''function buildListingStructuredData(listing: ClassifiedListing) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: plainText(listing.description, 300),
    url: absoluteUrl(`/listings/${listing.id}`),
    category: listing.categoryNameAr,
    areaServed: listing.governorateNameAr,
  };

  if (listing.primaryImageUrl) data.image = [absoluteUrl(listing.primaryImageUrl)];
  if (listing.price !== null) {
    data.offers = {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: listing.currency,
      availability: listing.reservedAt
        ? "https://schema.org/LimitedAvailability"
        : "https://schema.org/InStock",
      url: absoluteUrl(`/listings/${listing.id}`),
    };
  }

  return data;
}

'''
if old_function not in text:
    raise SystemExit("legacy structured data function not found")
text = text.replace(old_function, "", 1)
path.write_text(text)
