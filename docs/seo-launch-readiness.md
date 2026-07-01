# RAWAJ SEO + Launch Readiness Sprint

Starting branch: `main`

Starting HEAD: `0047152 Complete RAWAJ core marketplace messaging and seller systems`

## SEO foundation

- Added `src/lib/seo.ts` as the shared SEO helper.
- Supports page title, meta description, canonical URL, Open Graph title/description/type/url/image, Twitter card title/description/image, and optional `noindex`.
- Descriptions are normalized to plain text and truncated to avoid leaking formatted or overly long content into metadata.
- Default metadata is Arabic-first and uses honest RAWAJ marketplace wording.

## Environment and canonical URLs

- New recommended environment variable: `VITE_SITE_URL`.
- Runtime fallback: `http://localhost:3000`.
- Production must set `VITE_SITE_URL` to the public RAWAJ origin so canonical, Open Graph, Twitter image URLs, and JSON-LD URLs resolve to the launch domain.
- No production domain was assumed in code.

## Robots and sitemap

- Added `public/robots.txt`.
- Allows public routes and disallows private/account/admin routes:
  - `/admin`
  - `/admin/`
  - `/chats`
  - `/profile`
  - `/profile/`
  - `/add-listing`
  - `/login`
  - `/favorites`
  - `/saved-searches`
  - `/promotion`
- `robots.txt` does not include a `Sitemap:` reference because the production base URL is not confirmed.
- Static `sitemap.xml` is deferred until the real production domain is known. Once confirmed, add a static sitemap with absolute production URLs and add the matching `Sitemap:` reference in `robots.txt`.
- Dynamic listing and seller sitemap URLs are deferred until a safe server-side sitemap route can query approved public data without service-role secrets or client-side live database crawling.

## Page metadata

- Home: Arabic-first RAWAJ marketplace title and Syria classifieds description.
- Listings index: approved-listing browsing and search metadata.
- Listing detail: dynamic title, description, canonical, OG/Twitter metadata from approved listing data only.
- Seller profile: dynamic title, description, canonical, OG/Twitter metadata from public seller profile data only.
- Categories: category browsing metadata.
- Safety, support, promotion, terms, privacy, prohibited: route-specific metadata with launch-safe wording.

## Structured data

- Listing detail: `Product` JSON-LD using title, description, URL, image when available, category, governorate, and public price/currency when available.
- Seller profile: `Person` or `Organization` JSON-LD using public display/business name, public URL, description, public image when available, and governorate-level area served.
- Excluded from structured data: phone, email, WhatsApp, city area, account status, raw verification status, document paths, messages, pending/rejected content, and private profile fields.

## Copy cleanup

- Removed a verification-style icon from the home seller carousel because seller presence there only means the seller has approved listings.
- Changed safety page copy from “مساعدة فورية” to “مساعدة” to avoid implying instant support.

## Deferred

- Static `sitemap.xml` creation with absolute production URLs, and adding the matching `Sitemap:` reference in `robots.txt`, until the launch domain is confirmed.
- Dynamic sitemap entries for approved listing detail URLs.
- Dynamic sitemap entries for public seller URLs with at least one approved listing.
- Production-domain replacement for static `sitemap.xml`, and adding the matching absolute sitemap reference in `robots.txt`, once the launch domain is confirmed.
