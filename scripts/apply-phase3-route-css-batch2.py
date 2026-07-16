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
    'import activityMoreFoundationCss from "../activity-more-foundation.css?url";\n',
    'import trustSupportHubV2Css from "../trust-support-hub-v2.css?url";\n',
    'import communicationCenterV2Css from "../communication-center-v2.css?url";\n',
    'import listingStudioSignatureCss from "../listing-studio-signature.css?url";\n',
    'import listingStudioV2Css from "../listing-studio-v2.css?url";\n',
    'import listingStudioV3Css from "../listing-studio-v3.css?url";\n',
    'import messagingSignatureCss from "../messaging-signature.css?url";\n',
    'import myStoreBrandPolishCss from "../my-store-brand-polish.css?url";\n',
    'import myStoreHeaderRefinementCss from "../my-store-header-refinement.css?url";\n',
    'import myStoreRedesignCss from "../my-store-redesign.css?url";\n',
    'import personalSpacePolishCss from "../personal-space-polish.css?url";\n',
]:
    root = replace_once(root, import_line, "", f"remove {import_line.strip()}")

link_replacements = {
    '        { rel: "stylesheet", href: activityMoreFoundationCss },\n':
        '        ...(routeStyleScope.personalSpace ? [{ rel: "stylesheet", href: routeStyleHrefs.activityMoreFoundation }] : []),\n',
    '        { rel: "stylesheet", href: trustSupportHubV2Css },\n':
        '        ...(routeStyleScope.trustSupport ? [{ rel: "stylesheet", href: routeStyleHrefs.trustSupportHubV2 }] : []),\n',
    '        { rel: "stylesheet", href: myStoreRedesignCss },\n':
        '        ...(routeStyleScope.ownerStore ? [{ rel: "stylesheet", href: routeStyleHrefs.myStoreRedesign }] : []),\n',
    '        { rel: "stylesheet", href: listingStudioSignatureCss },\n':
        '        ...(routeStyleScope.listingStudio ? [{ rel: "stylesheet", href: routeStyleHrefs.listingStudioSignature }] : []),\n',
    '        { rel: "stylesheet", href: listingStudioV2Css },\n':
        '        ...(routeStyleScope.listingStudio ? [{ rel: "stylesheet", href: routeStyleHrefs.listingStudioV2 }] : []),\n',
    '        { rel: "stylesheet", href: listingStudioV3Css },\n':
        '        ...(routeStyleScope.listingStudio ? [{ rel: "stylesheet", href: routeStyleHrefs.listingStudioV3 }] : []),\n',
    '        { rel: "stylesheet", href: messagingSignatureCss },\n':
        '        ...(routeStyleScope.messaging ? [{ rel: "stylesheet", href: routeStyleHrefs.messagingSignature }] : []),\n',
    '        { rel: "stylesheet", href: communicationCenterV2Css },\n':
        '        ...(routeStyleScope.communication ? [{ rel: "stylesheet", href: routeStyleHrefs.communicationCenterV2 }] : []),\n',
    '        { rel: "stylesheet", href: myStoreHeaderRefinementCss },\n':
        '        ...(routeStyleScope.ownerStore ? [{ rel: "stylesheet", href: routeStyleHrefs.myStoreHeaderRefinement }] : []),\n',
    '        { rel: "stylesheet", href: myStoreBrandPolishCss },\n':
        '        ...(routeStyleScope.ownerStore ? [{ rel: "stylesheet", href: routeStyleHrefs.myStoreBrandPolish }] : []),\n',
    '        { rel: "stylesheet", href: personalSpacePolishCss },\n':
        '        ...(routeStyleScope.personalSpace ? [{ rel: "stylesheet", href: routeStyleHrefs.personalSpacePolish }] : []),\n',
}
for old, new in link_replacements.items():
    root = replace_once(root, old, new, f"scope {old.strip()}")
write(root_path, root)

styles_path = "src/lib/route-styles.ts"
styles = Path(styles_path).read_text(encoding="utf-8")
styles = replace_once(
    styles,
    'import homeDiscoveryV3Css from "../home-discovery-v3.css?url";\n',
    'import activityMoreFoundationCss from "../activity-more-foundation.css?url";\n'
    'import communicationCenterV2Css from "../communication-center-v2.css?url";\n'
    'import homeDiscoveryV3Css from "../home-discovery-v3.css?url";\n',
    "route style imports start",
)
styles = replace_once(
    styles,
    'import listingDetailV3Css from "../listing-detail-v3.css?url";\n',
    'import listingDetailV3Css from "../listing-detail-v3.css?url";\n'
    'import listingStudioSignatureCss from "../listing-studio-signature.css?url";\n'
    'import listingStudioV2Css from "../listing-studio-v2.css?url";\n'
    'import listingStudioV3Css from "../listing-studio-v3.css?url";\n',
    "studio imports",
)
styles = replace_once(
    styles,
    'import listingsResultsCss from "../listings-results.css?url";\n',
    'import listingsResultsCss from "../listings-results.css?url";\n'
    'import messagingSignatureCss from "../messaging-signature.css?url";\n'
    'import myStoreBrandPolishCss from "../my-store-brand-polish.css?url";\n'
    'import myStoreHeaderRefinementCss from "../my-store-header-refinement.css?url";\n'
    'import myStoreRedesignCss from "../my-store-redesign.css?url";\n',
    "messaging and store imports",
)
styles = replace_once(
    styles,
    'import offersSignatureCss from "../offers-signature.css?url";\n',
    'import offersSignatureCss from "../offers-signature.css?url";\n'
    'import personalSpacePolishCss from "../personal-space-polish.css?url";\n',
    "personal import",
)
styles = replace_once(
    styles,
    'import sellerStorefrontV2Css from "../seller-storefront-v2.css?url";\n',
    'import sellerStorefrontV2Css from "../seller-storefront-v2.css?url";\n'
    'import trustSupportHubV2Css from "../trust-support-hub-v2.css?url";\n',
    "trust import",
)
styles = replace_once(
    styles,
    '  sellerStorefrontV2: sellerStorefrontV2Css,\n',
    '  sellerStorefrontV2: sellerStorefrontV2Css,\n'
    '  listingStudioSignature: listingStudioSignatureCss,\n'
    '  listingStudioV2: listingStudioV2Css,\n'
    '  listingStudioV3: listingStudioV3Css,\n'
    '  messagingSignature: messagingSignatureCss,\n'
    '  communicationCenterV2: communicationCenterV2Css,\n'
    '  activityMoreFoundation: activityMoreFoundationCss,\n'
    '  personalSpacePolish: personalSpacePolishCss,\n'
    '  myStoreRedesign: myStoreRedesignCss,\n'
    '  myStoreHeaderRefinement: myStoreHeaderRefinementCss,\n'
    '  myStoreBrandPolish: myStoreBrandPolishCss,\n'
    '  trustSupportHubV2: trustSupportHubV2Css,\n',
    "route style hrefs",
)
styles = replace_once(
    styles,
    '  storefront: boolean;\n',
    '  storefront: boolean;\n'
    '  listingStudio: boolean;\n'
    '  messaging: boolean;\n'
    '  communication: boolean;\n'
    '  personalSpace: boolean;\n'
    '  ownerStore: boolean;\n'
    '  trustSupport: boolean;\n',
    "scope interface",
)
styles = replace_once(
    styles,
    '    storefront:\n      /^\\/seller\\/[^/]+$/.test(normalizedPathname) || normalizedPathname === "/profile/listings",\n',
    '    storefront:\n      /^\\/seller\\/[^/]+$/.test(normalizedPathname) || normalizedPathname === "/profile/listings",\n'
    '    listingStudio:\n      normalizedPathname === "/add-listing" || /^\\/profile\\/listings\\/[^/]+$/.test(normalizedPathname),\n'
    '    messaging: normalizedPathname === "/chats",\n'
    '    communication: ["/chats", "/notifications", "/activity"].includes(normalizedPathname),\n'
    '    personalSpace: [\n'
    '      "/favorites",\n'
    '      "/saved-searches",\n'
    '      "/activity",\n'
    '      "/chats",\n'
    '      "/notifications",\n'
    '      "/more",\n'
    '      "/profile",\n'
    '    ].includes(normalizedPathname),\n'
    '    ownerStore: normalizedPathname === "/profile/listings",\n'
    '    trustSupport: ["/support", "/safety", "/terms", "/privacy"].includes(normalizedPathname),\n',
    "scope resolution",
)
write(styles_path, styles)

# Update permanent contracts that verify cascade ownership.
for test_path in ["scripts/listing-studio-v2.test.mjs", "scripts/listing-studio-v3.test.mjs"]:
    test_source = Path(test_path).read_text(encoding="utf-8")
    if test_path.endswith("v2.test.mjs"):
        test_source = replace_once(
            test_source,
            "const [root, shared, createRoute, manageRoute, css, qualityGate] = await Promise.all([\n",
            "const [root, routeStyles, shared, createRoute, manageRoute, css, qualityGate] = await Promise.all([\n",
            "studio v2 vars",
        )
        test_source = replace_once(
            test_source,
            '  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),\n',
            '  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),\n'
            '  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),\n',
            "studio v2 read styles",
        )
        test_source = test_source.replace(
            'assert.match(root, /import listingStudioV2Css from "\\.\\.\\/listing-studio-v2\\.css\\?url"/);',
            'assert.match(routeStyles, /import listingStudioV2Css from "\\.\\.\\/listing-studio-v2\\.css\\?url"/);',
        )
        test_source = test_source.replace('"href: listingStudioSignatureCss"', '"routeStyleHrefs.listingStudioSignature"')
        test_source = test_source.replace('"href: listingStudioV2Css"', '"routeStyleHrefs.listingStudioV2"')
    else:
        test_source = replace_once(
            test_source,
            "const [root, shared, createRoute, manageRoute, storage, writes, lifecycle, css, gate] =\n",
            "const [root, routeStyles, shared, createRoute, manageRoute, storage, writes, lifecycle, css, gate] =\n",
            "studio v3 vars",
        )
        test_source = replace_once(
            test_source,
            '    readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),\n',
            '    readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),\n'
            '    readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),\n',
            "studio v3 read styles",
        )
        test_source = test_source.replace("assert.match(root, /listingStudioV3Css/);", "assert.match(routeStyles, /listingStudioV3Css/);")
        test_source = test_source.replace('"href: listingStudioV3Css"', '"routeStyleHrefs.listingStudioV3"')
        test_source = test_source.replace('"href: listingStudioV2Css"', '"routeStyleHrefs.listingStudioV2"')
    write(test_path, test_source)

communication_path = "scripts/communication-center-v2.test.mjs"
communication = Path(communication_path).read_text(encoding="utf-8")
communication = replace_once(
    communication,
    "const [root, shared, notificationCard, chats, notifications, activity, css, qualityGate] =\n",
    "const [root, routeStyles, shared, notificationCard, chats, notifications, activity, css, qualityGate] =\n",
    "communication vars",
)
communication = replace_once(
    communication,
    '    readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),\n',
    '    readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),\n'
    '    readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),\n',
    "communication read styles",
)
communication = communication.replace(
    '    root,\n    /import communicationCenterV2Css from "\\.\\.\\/communication-center-v2\\.css\\?url"/,',
    '    routeStyles,\n    /import communicationCenterV2Css from "\\.\\.\\/communication-center-v2\\.css\\?url"/,',
)
communication = communication.replace('"href: messagingSignatureCss"', '"routeStyleHrefs.messagingSignature"')
communication = communication.replace('"href: communicationCenterV2Css"', '"routeStyleHrefs.communicationCenterV2"')
write(communication_path, communication)

quality_path = ".github/workflows/quality-gate.yml"
quality = Path(quality_path).read_text(encoding="utf-8")
quality = replace_once(
    quality,
    "      - name: Deferred root services contract\n        run: node --test scripts/deferred-root-services.test.mjs\n",
    "      - name: Deferred root services contract\n        run: node --test scripts/deferred-root-services.test.mjs\n\n"
    "      - name: Route CSS isolation batch 2 contract\n        run: node --test scripts/route-css-isolation-batch-2.test.mjs\n",
    "quality batch 2 step",
)
write(quality_path, quality)

# Add raw HTML checks for route-specific second-batch styles.
e2e_path = "e2e/public-initial-html.spec.ts"
e2e = Path(e2e_path).read_text(encoding="utf-8")
insert = '''\n  test("secondary public routes include their own CSS without unrelated page layers", async ({ request }) => {\n    const supportResponse = await request.get("/support", { headers: { accept: "text/html" } });\n    const supportStyles = stylesheetHrefs(await supportResponse.text());\n    expect(supportStyles.some((href) => href.includes("trust-support-hub-v2"))).toBeTruthy();\n    expect(supportStyles.some((href) => href.includes("listing-studio-v3"))).toBeFalsy();\n    expect(supportStyles.some((href) => href.includes("communication-center-v2"))).toBeFalsy();\n\n    const chatsResponse = await request.get("/chats", { headers: { accept: "text/html" } });\n    const chatStyles = stylesheetHrefs(await chatsResponse.text());\n    expect(chatStyles.some((href) => href.includes("messaging-signature"))).toBeTruthy();\n    expect(chatStyles.some((href) => href.includes("communication-center-v2"))).toBeTruthy();\n    expect(chatStyles.some((href) => href.includes("personal-space-polish"))).toBeTruthy();\n    expect(chatStyles.some((href) => href.includes("listing-studio-v3"))).toBeFalsy();\n\n    const studioResponse = await request.get("/add-listing", { headers: { accept: "text/html" } });\n    const studioStyles = stylesheetHrefs(await studioResponse.text());\n    expect(studioStyles.some((href) => href.includes("listing-studio-v2"))).toBeTruthy();\n    expect(studioStyles.some((href) => href.includes("listing-studio-v3"))).toBeTruthy();\n    expect(studioStyles.some((href) => href.includes("messaging-signature"))).toBeFalsy();\n  });\n'''
close = e2e.rfind("});")
if close < 0:
    raise RuntimeError("e2e describe close not found")
e2e = e2e[:close] + insert + e2e[close:]
write(e2e_path, e2e)
