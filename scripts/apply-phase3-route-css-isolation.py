from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


root_path = "src/routes/__root.tsx"
root = Path(root_path).read_text(encoding="utf-8")

for import_line in [
    'import homeDiscoveryV3Css from "../home-discovery-v3.css?url";\n',
    'import homeMarketplaceV2Css from "../home-marketplace-v2.css?url";\n',
    'import homeSignatureCss from "../home-signature.css?url";\n',
    'import listingDetailFoundationCss from "../listing-detail-foundation.css?url";\n',
    'import listingDetailV2Css from "../listing-detail-v2.css?url";\n',
    'import listingDetailV3Css from "../listing-detail-v3.css?url";\n',
    'import listingsResultsCss from "../listings-results.css?url";\n',
    'import offersSignatureCss from "../offers-signature.css?url";\n',
    'import searchFiltersV1Css from "../search-filters-v1.css?url";\n',
    'import searchFiltersV2Css from "../search-filters-v2.css?url";\n',
    'import sellerStorefrontFoundationCss from "../seller-storefront-foundation.css?url";\n',
    'import sellerStorefrontV2Css from "../seller-storefront-v2.css?url";\n',
]:
    root = replace_once(root, import_line, "", f"remove {import_line.strip()}")

root = replace_once(
    root,
    'import { reportLovableError } from "@/lib/lovable-error-reporting";\n',
    'import { reportLovableError } from "@/lib/lovable-error-reporting";\nimport { resolveRouteStyleScope, routeStyleHrefs } from "@/lib/route-styles";\n',
    "add route styles import",
)
root = replace_once(root, "  head: () => {\n", "  head: ({ matches }) => {\n", "root head args")
root = replace_once(
    root,
    "    const seo = createSeo({ title: ROOT_TITLE, description: ROOT_DESCRIPTION });\n",
    "    const seo = createSeo({ title: ROOT_TITLE, description: ROOT_DESCRIPTION });\n    const activeMatch = matches[matches.length - 1];\n    const routeStyleScope = resolveRouteStyleScope(activeMatch?.pathname ?? \"/\");\n",
    "root route style scope",
)

link_replacements = {
    '        { rel: "stylesheet", href: homeSignatureCss },\n':
        '        ...(routeStyleScope.home ? [{ rel: "stylesheet", href: routeStyleHrefs.homeSignature }] : []),\n',
    '        { rel: "stylesheet", href: listingsResultsCss },\n':
        '        ...(routeStyleScope.listingResults ? [{ rel: "stylesheet", href: routeStyleHrefs.listingsResults }] : []),\n',
    '        { rel: "stylesheet", href: listingDetailFoundationCss },\n':
        '        ...(routeStyleScope.listingDetail ? [{ rel: "stylesheet", href: routeStyleHrefs.listingDetailFoundation }] : []),\n',
    '        { rel: "stylesheet", href: sellerStorefrontFoundationCss },\n':
        '        ...(routeStyleScope.storefront ? [{ rel: "stylesheet", href: routeStyleHrefs.sellerStorefrontFoundation }] : []),\n',
    '        { rel: "stylesheet", href: sellerStorefrontV2Css },\n':
        '        ...(routeStyleScope.storefront ? [{ rel: "stylesheet", href: routeStyleHrefs.sellerStorefrontV2 }] : []),\n',
    '        { rel: "stylesheet", href: offersSignatureCss },\n':
        '        ...(routeStyleScope.offers ? [{ rel: "stylesheet", href: routeStyleHrefs.offersSignature }] : []),\n',
    '        { rel: "stylesheet", href: homeMarketplaceV2Css },\n':
        '        ...(routeStyleScope.home ? [{ rel: "stylesheet", href: routeStyleHrefs.homeMarketplaceV2 }] : []),\n',
    '        { rel: "stylesheet", href: homeDiscoveryV3Css },\n':
        '        ...(routeStyleScope.home ? [{ rel: "stylesheet", href: routeStyleHrefs.homeDiscoveryV3 }] : []),\n',
    '        { rel: "stylesheet", href: searchFiltersV1Css },\n':
        '        ...(routeStyleScope.listingResults ? [{ rel: "stylesheet", href: routeStyleHrefs.searchFiltersV1 }] : []),\n',
    '        { rel: "stylesheet", href: searchFiltersV2Css },\n':
        '        ...(routeStyleScope.listingResults ? [{ rel: "stylesheet", href: routeStyleHrefs.searchFiltersV2 }] : []),\n',
    '        { rel: "stylesheet", href: listingDetailV2Css },\n':
        '        ...(routeStyleScope.listingDetail ? [{ rel: "stylesheet", href: routeStyleHrefs.listingDetailV2 }] : []),\n',
    '        { rel: "stylesheet", href: listingDetailV3Css },\n':
        '        ...(routeStyleScope.listingDetail ? [{ rel: "stylesheet", href: routeStyleHrefs.listingDetailV3 }] : []),\n',
}
for old, new in link_replacements.items():
    root = replace_once(root, old, new, f"scope {old.strip()}")
write(root_path, root)

# Keep permanent contracts aligned with route-scoped ownership while preserving cascade checks.
home_test_path = "scripts/home-discovery-v3.test.mjs"
home_test = Path(home_test_path).read_text(encoding="utf-8")
home_test = replace_once(home_test, "  root,\n  home,\n", "  root,\n  routeStyles,\n  home,\n", "home test vars")
home_test = replace_once(
    home_test,
    '  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),\n  readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8"),\n',
    '  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),\n  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),\n  readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8"),\n',
    "home test reads",
)
home_test = home_test.replace(
    'assert.match(root, /import homeDiscoveryV3Css from "\\.\\.\\/home-discovery-v3\\.css\\?url";/);',
    'assert.match(routeStyles, /import homeDiscoveryV3Css from "\\.\\.\\/home-discovery-v3\\.css\\?url";/);',
)
home_test = home_test.replace('"href: homeMarketplaceV2Css"', '"routeStyleHrefs.homeMarketplaceV2"')
home_test = home_test.replace('"href: homeDiscoveryV3Css"', '"routeStyleHrefs.homeDiscoveryV3"')
write(home_test_path, home_test)

adaptive_path = "scripts/adaptive-listing-cards.test.mjs"
adaptive = Path(adaptive_path).read_text(encoding="utf-8")
adaptive = adaptive.replace('"href: homeDiscoveryV3Css"', '"routeStyleHrefs.homeDiscoveryV3"')
write(adaptive_path, adaptive)

search_v1_path = "scripts/search-filters-v1.test.mjs"
search_v1 = Path(search_v1_path).read_text(encoding="utf-8")
search_v1 = replace_once(
    search_v1,
    "const [root, route, categories, schema, filters, api, toolbar, quickFilters, sheet, empty, css] =\n",
    "const [root, routeStyles, route, categories, schema, filters, api, toolbar, quickFilters, sheet, empty, css] =\n",
    "search v1 vars",
)
search_v1 = replace_once(
    search_v1,
    '    readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),\n    readFile(new URL("../src/routes/listings.index.tsx", import.meta.url), "utf8"),\n',
    '    readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),\n    readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),\n    readFile(new URL("../src/routes/listings.index.tsx", import.meta.url), "utf8"),\n',
    "search v1 reads",
)
search_v1 = search_v1.replace(
    'assert.match(root, /import searchFiltersV1Css from "\\.\\.\\/search-filters-v1\\.css\\?url";/);',
    'assert.match(routeStyles, /import searchFiltersV1Css from "\\.\\.\\/search-filters-v1\\.css\\?url";/);',
)
search_v1 = search_v1.replace('"href: searchFiltersV1Css"', '"routeStyleHrefs.searchFiltersV1"')
write(search_v1_path, search_v1)

search_v2_path = "scripts/search-filters-v2.test.mjs"
search_v2 = Path(search_v2_path).read_text(encoding="utf-8")
search_v2 = replace_once(
    search_v2,
    "const [root, toolbar, css, gate] = await Promise.all([\n",
    "const [root, routeStyles, toolbar, css, gate] = await Promise.all([\n",
    "search v2 vars",
)
search_v2 = replace_once(
    search_v2,
    '  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),\n  readFile(new URL("../src/features/search/SearchResultsToolbar.tsx", import.meta.url), "utf8"),\n',
    '  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),\n  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),\n  readFile(new URL("../src/features/search/SearchResultsToolbar.tsx", import.meta.url), "utf8"),\n',
    "search v2 reads",
)
search_v2 = search_v2.replace("assert.match(root, /searchFiltersV2Css/);", "assert.match(routeStyles, /searchFiltersV2Css/);")
search_v2 = search_v2.replace('"href: searchFiltersV1Css"', '"routeStyleHrefs.searchFiltersV1"')
search_v2 = search_v2.replace('"href: searchFiltersV2Css"', '"routeStyleHrefs.searchFiltersV2"')
write(search_v2_path, search_v2)

v2_path = "scripts/listing-detail-v2.test.mjs"
v2 = Path(v2_path).read_text(encoding="utf-8")
v2 = replace_once(
    v2,
    "const [root, route, detailPageData, media, viewer, seller, dock, safety, similar, css, navigation] =\n",
    "const [root, routeStyles, route, detailPageData, media, viewer, seller, dock, safety, similar, css, navigation] =\n",
    "detail v2 vars",
)
v2 = replace_once(
    v2,
    '    readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),\n    readFile(new URL("../src/routes/listings.$id.tsx", import.meta.url), "utf8"),\n',
    '    readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),\n    readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),\n    readFile(new URL("../src/routes/listings.$id.tsx", import.meta.url), "utf8"),\n',
    "detail v2 reads",
)
v2 = v2.replace(
    'assert.match(root, /import listingDetailV2Css from "\\.\\.\\/listing-detail-v2\\.css\\?url";/);',
    'assert.match(routeStyles, /import listingDetailV2Css from "\\.\\.\\/listing-detail-v2\\.css\\?url";/);',
)
v2 = v2.replace('"href: searchFiltersV1Css"', '"routeStyleHrefs.searchFiltersV1"')
v2 = v2.replace('"href: listingDetailV2Css"', '"routeStyleHrefs.listingDetailV2"')
write(v2_path, v2)

v3_path = "scripts/listing-detail-v3.test.mjs"
v3 = Path(v3_path).read_text(encoding="utf-8")
v3 = replace_once(v3, "  rootRoute,\n  detailRoute,\n", "  rootRoute,\n  routeStyles,\n  detailRoute,\n", "detail v3 vars")
v3 = replace_once(
    v3,
    '  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),\n  readFile(new URL("../src/routes/listings.$id.tsx", import.meta.url), "utf8"),\n',
    '  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),\n  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),\n  readFile(new URL("../src/routes/listings.$id.tsx", import.meta.url), "utf8"),\n',
    "detail v3 reads",
)
v3 = v3.replace(
    'assert.match(rootRoute, /listingDetailV3Css from "\\.\\.\\/listing-detail-v3\\.css\\?url"/);',
    'assert.match(routeStyles, /listingDetailV3Css from "\\.\\.\\/listing-detail-v3\\.css\\?url"/);',
)
v3 = v3.replace('"href: listingDetailV3Css"', '"routeStyleHrefs.listingDetailV3"')
v3 = v3.replace('"href: listingDetailV2Css"', '"routeStyleHrefs.listingDetailV2"')
write(v3_path, v3)

seller_path = "scripts/seller-storefront-v2.test.mjs"
seller = Path(seller_path).read_text(encoding="utf-8")
seller = replace_once(
    seller,
    "const [root, shared, publicRoute, ownerRoute, css, qualityGate, barrel] = await Promise.all([\n",
    "const [root, routeStyles, shared, publicRoute, ownerRoute, css, qualityGate, barrel] = await Promise.all([\n",
    "seller vars",
)
seller = replace_once(
    seller,
    '  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),\n  readFile(\n',
    '  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),\n  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),\n  readFile(\n',
    "seller reads",
)
seller = seller.replace(
    'assert.match(root, /import sellerStorefrontV2Css from "\\.\\.\\/seller-storefront-v2\\.css\\?url"/);',
    'assert.match(routeStyles, /import sellerStorefrontV2Css from "\\.\\.\\/seller-storefront-v2\\.css\\?url"/);',
)
seller = seller.replace('"href: sellerStorefrontFoundationCss"', '"routeStyleHrefs.sellerStorefrontFoundation"')
seller = seller.replace('"href: sellerStorefrontV2Css"', '"routeStyleHrefs.sellerStorefrontV2"')
write(seller_path, seller)

# Add a raw-HTML browser assertion that checks stylesheet links rather than bundle text.
e2e_path = "e2e/public-initial-html.spec.ts"
e2e = Path(e2e_path).read_text(encoding="utf-8")
e2e = replace_once(
    e2e,
    'import { expect, test } from "@playwright/test";\n\n',
    'import { expect, test } from "@playwright/test";\n\nfunction stylesheetHrefs(html: string) {\n  return [...html.matchAll(/<link\\b[^>]*\\brel="stylesheet"[^>]*\\bhref="([^"]+)"/g)].map(\n    (match) => match[1],\n  );\n}\n\n',
    "e2e stylesheet parser",
)
e2e = replace_once(
    e2e,
    '    expect(detailHtml).toContain("rawaj-detail-seller");\n    expect(detailHtml).not.toMatch(/جاري تحميل الإعلان|Loading listing/i);\n',
    '    expect(detailHtml).toContain("rawaj-detail-seller");\n    expect(detailHtml).not.toMatch(/جاري تحميل الإعلان|Loading listing/i);\n\n    const detailStyles = stylesheetHrefs(detailHtml);\n    expect(detailStyles.some((href) => href.includes("listing-detail-v3"))).toBeTruthy();\n    expect(detailStyles.some((href) => href.includes("home-discovery-v3"))).toBeFalsy();\n    expect(detailStyles.some((href) => href.includes("search-filters-v2"))).toBeFalsy();\n',
    "detail e2e css assertions",
)
route_css_test = '''\n  test("public route HTML includes only its scoped stylesheet group", async ({ request }) => {\n    const homeResponse = await request.get("/", { headers: { accept: "text/html" } });\n    const homeStyles = stylesheetHrefs(await homeResponse.text());\n    expect(homeStyles.some((href) => href.includes("home-discovery-v3"))).toBeTruthy();\n    expect(homeStyles.some((href) => href.includes("listing-detail-v3"))).toBeFalsy();\n    expect(homeStyles.some((href) => href.includes("search-filters-v2"))).toBeFalsy();\n\n    const listingsResponse = await request.get("/listings", {\n      headers: { accept: "text/html" },\n    });\n    const listingStyles = stylesheetHrefs(await listingsResponse.text());\n    expect(listingStyles.some((href) => href.includes("listings-results"))).toBeTruthy();\n    expect(listingStyles.some((href) => href.includes("search-filters-v2"))).toBeTruthy();\n    expect(listingStyles.some((href) => href.includes("home-discovery-v3"))).toBeFalsy();\n    expect(listingStyles.some((href) => href.includes("listing-detail-v3"))).toBeFalsy();\n\n    const offersResponse = await request.get("/offers", { headers: { accept: "text/html" } });\n    const offerStyles = stylesheetHrefs(await offersResponse.text());\n    expect(offerStyles.some((href) => href.includes("offers-signature"))).toBeTruthy();\n    expect(offerStyles.some((href) => href.includes("home-discovery-v3"))).toBeFalsy();\n    expect(offerStyles.some((href) => href.includes("seller-storefront-v2"))).toBeFalsy();\n  });\n'''
last_close = e2e.rfind("});")
if last_close < 0:
    raise RuntimeError("e2e describe close not found")
e2e = e2e[:last_close] + route_css_test + e2e[last_close:]
write(e2e_path, e2e)

quality_path = ".github/workflows/quality-gate.yml"
quality = Path(quality_path).read_text(encoding="utf-8")
quality = replace_once(
    quality,
    "      - name: Listing Detail V2 contract\n        run: node --test scripts/listing-detail-v2.test.mjs\n",
    "      - name: Route CSS isolation contract\n        run: node --test scripts/route-css-isolation.test.mjs\n\n      - name: Listing Detail V2 contract\n        run: node --test scripts/listing-detail-v2.test.mjs\n",
    "quality route css step",
)
write(quality_path, quality)
