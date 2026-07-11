from pathlib import Path


def replace_exact(value: str, old: str, new: str, label: str) -> str:
    if old not in value:
        raise RuntimeError(f"Missing {label}")
    return value.replace(old, new, 1)


# Root stylesheet ordering.
p = Path("src/routes/__root.tsx")
s = p.read_text()
s = replace_exact(
    s,
    'import sellerStorefrontFoundationCss from "../seller-storefront-foundation.css?url";',
    'import sellerStorefrontFoundationCss from "../seller-storefront-foundation.css?url";\nimport sellerStorefrontV2Css from "../seller-storefront-v2.css?url";',
    "root storefront import",
)
s = replace_exact(
    s,
    '        { rel: "stylesheet", href: sellerStorefrontFoundationCss },',
    '        { rel: "stylesheet", href: sellerStorefrontFoundationCss },\n        { rel: "stylesheet", href: sellerStorefrontV2Css },',
    "root storefront link",
)
p.write_text(s)

# Public seller storefront.
p = Path("src/routes/seller.$id.tsx")
s = p.read_text()
s = replace_exact(
    s,
    '''import {
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  MapPin,
  MessageSquare,
  ShieldAlert,
  Star,
} from "lucide-react";''',
    'import { MessageSquare, ShieldAlert, Star } from "lucide-react";',
    "seller icons",
)
s = s.replace('import { PlaceholderArt } from "@/components/PlaceholderArt";\n', "")
s = replace_exact(
    s,
    'import { SellerReviewCard } from "@/features/reviews/SellerReviewCard";',
    '''import { SellerReviewCard } from "@/features/reviews/SellerReviewCard";
import { AdaptiveListingCard } from "@/features/listings/cards/AdaptiveListingCard";
import {
  StorefrontIdentityHero,
  StorefrontNotice,
  StorefrontSectionHeader,
} from "@/features/storefront/StorefrontIdentityHero";''',
    "seller storefront imports",
)
s = replace_exact(
    s,
    'import type { ClassifiedListing, PublicSellerProfile } from "@/lib/classifieds-types";',
    'import type { PublicSellerProfile } from "@/lib/classifieds-types";',
    "seller type import",
)
s = s.replace('import { categoryName, formatPriceLocalized, governorateName } from "@/lib/i18n";\n', "")
s = replace_exact(
    s,
    '<div className="rawaj-pulse-page min-h-dvh" dir={language === "ar" ? "rtl" : "ltr"}>',
    '<div className="rawaj-storefront-v2 min-h-dvh" dir={language === "ar" ? "rtl" : "ltr"}>',
    "seller root class",
)
s = replace_exact(
    s,
    '          <StorefrontHero seller={seller} />',
    '''          <StorefrontIdentityHero
            mode="public"
            sellerId={seller.id}
            displayName={seller.businessName || seller.displayName}
            secondaryName={seller.businessName ? seller.displayName : null}
            avatarUrl={seller.avatarUrl}
            coverUrl={seller.coverUrl}
            bio={seller.bio}
            location={seller.locationAr}
            verified={seller.verified}
            joinedAt={seller.joinedAt}
            ratingAverage={seller.ratingSummary.average}
            ratingCount={seller.ratingSummary.count}
            approvedCount={seller.approvedListingCount}
          />''',
    "seller shared hero",
)
s = replace_exact(
    s,
    '<section className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)] lg:items-start">',
    '<section className="rawaj-storefront-v2__layout">',
    "seller layout",
)
layout_index = s.index('<section className="rawaj-storefront-v2__layout">')
first_space = s.index('<div className="space-y-4">', layout_index)
s = s[:first_space] + s[first_space:].replace(
    '<div className="space-y-4">',
    '<div className="rawaj-storefront-v2__main">',
    1,
)
second_space = s.index('<div className="space-y-4">', first_space + 1)
s = s[:second_space] + s[second_space:].replace(
    '<div className="space-y-4">',
    '<div className="rawaj-storefront-v2__aside">',
    1,
)
heading_start = s.index('              <div className="rawaj-storefront-section">', layout_index)
heading_end = s.index('              </div>\n\n              {seller.listings.length === 0 ?', heading_start) + len('              </div>')
heading = '''              <StorefrontSectionHeader
                eyebrow={text("منتجات الواجهة", "Storefront products")}
                title={text("المعروض الآن", "Available now")}
                description={text(
                  "إعلانات عامة معتمدة ومتاح تصفحها مباشرة.",
                  "Approved public listings available to browse now.",
                )}
                count={seller.listings.length}
              />'''
s = s[:heading_start] + heading + s[heading_end:]
empty_start = s.index('              {seller.listings.length === 0 ? (', layout_index)
empty_mid = s.index('              ) : (', empty_start)
empty_replacement = '''              {seller.listings.length === 0 ? (
                <StorefrontNotice
                  tone="empty"
                  title={text("لا توجد إعلانات عامة الآن", "No public listings right now")}
                  description={text(
                    "ستظهر هنا الإعلانات المعتمدة عندما ينشر البائع عروضاً جديدة.",
                    "Approved listings will appear here when the seller publishes new offers.",
                  )}
                />
              ) : ('''
s = s[:empty_start] + empty_replacement + s[empty_mid + len('              ) : ('):]
s = s.replace(
    '<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">',
    '<div id="storefront-listings" className="rawaj-storefront-v2__product-grid">',
    1,
)
s = s.replace(
    '''{seller.listings.map((listing: ClassifiedListing) => (
                    <SellerListingCard key={listing.id} listing={listing} />
                  ))}''',
    '''{seller.listings.map((listing) => (
                    <AdaptiveListingCard key={listing.id} listing={listing} />
                  ))}''',
    1,
)
hero_start = s.index('function StorefrontHero(')
seo_start = s.index('function sellerSeoDescription', hero_start)
s = s[:hero_start] + s[seo_start:]
s = s.replace(
    'className="rawaj-color-card rawaj-world-gold scroll-mt-24 rounded-[1.5rem] p-4 sm:p-5"',
    'className="rawaj-storefront-v2__reviews"',
    1,
)
s = s.replace(
    'className="relative overflow-hidden rounded-[1.5rem] bg-primary p-5 text-primary-foreground shadow-premium"',
    'className="rawaj-storefront-safety"',
    1,
)
card_start = s.index('function SellerListingCard(')
state_start = s.index('function SellerState(', card_start)
s = s[:card_start] + s[state_start:]
p.write_text(s)

# Owner store workspace.
p = Path("src/routes/profile/listings.tsx")
s = p.read_text()
s = replace_exact(
    s,
    'import { PlaceholderArt } from "@/components/PlaceholderArt";',
    '''import { PlaceholderArt } from "@/components/PlaceholderArt";
import {
  StorefrontIdentityHero,
  StorefrontNotice,
} from "@/features/storefront/StorefrontIdentityHero";''',
    "owner storefront imports",
)
s = replace_exact(
    s,
    '<main className="rawaj-pulse-page container-wide mobile-page-bottom space-y-5 pb-8 pt-3 sm:pt-5">',
    '<main className="rawaj-storefront-v2 rawaj-storefront-v2--owner container-wide mobile-page-bottom space-y-5 pb-8 pt-3 sm:pt-5">',
    "owner root class",
)
header_start = s.index('        <StoreHeader')
header_end = s.index('        />', header_start) + len('        />')
header = '''        <StorefrontIdentityHero
          mode="owner"
          sellerId={profileId ?? ""}
          displayName={displayName}
          secondaryName={auth.profile?.businessName ? auth.profile?.displayName : null}
          avatarUrl={auth.profile?.avatarUrl}
          coverUrl={auth.profile?.coverUrl}
          bio={auth.profile?.bio}
          location={auth.profile?.cityArea || auth.profile?.governorate}
          verified={sellerProfile?.verified ?? false}
          joinedAt={sellerProfile?.joinedAt}
          ratingAverage={ratingAverage}
          ratingCount={ratingCount}
          approvedCount={grouped.approved.length}
          pendingCount={grouped.pending.length}
          needsEditCount={grouped.needs_edit.length}
          closedCount={grouped.closed.length}
        />'''
s = s[:header_start] + header + s[header_end:]

draft_start = s.index('        {latestDraft && (')
rail_start = s.index('        <section className="rawaj-merchant-rail">', draft_start)
draft = '''        {latestDraft ? (
          <StorefrontNotice
            tone="draft"
            title={text("لديك مسودة محفوظة", "You have a saved draft")}
            description={`${latestDraft.title} · ${text("آخر حفظ", "Last saved")} ${formatSavedAt(
              latestDraft.updatedAt,
              language,
            )}`}
            action={
              <>
                <button type="button" onClick={() => setActiveTab("needs_edit")}>
                  {text("عرض المسودات", "Show drafts")}
                </button>
                <Link to="/profile/listings/$id" params={{ id: latestDraft.id }}>
                  {text("متابعة المسودة", "Resume draft")}
                </Link>
              </>
            }
          />
        ) : null}

'''
s = s[:draft_start] + draft + s[rail_start:]
rail_start = s.index('        <section className="rawaj-merchant-rail">')
tabs_start = s.index('        <div className="rawaj-storefront-section flex', rail_start)
s = s[:rail_start] + s[tabs_start:]
s = s.replace(
    '<div className="rawaj-storefront-section flex flex-wrap items-center justify-between gap-3 pt-1">',
    '<div className="flex flex-wrap items-center justify-between gap-3 pt-1">',
    1,
)
s = s.replace(
    '<div className="flex gap-2 overflow-x-auto pb-1">',
    '<div className="rawaj-storefront-owner-tabs">',
    1,
)
s = s.replace(
    '<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">',
    '<div className="rawaj-storefront-owner-grid">',
    1,
)
store_header_start = s.index('function StoreHeader(')
tab_start = s.index('function TabButton(', store_header_start)
s = s[:store_header_start] + s[tab_start:]
s = s.replace(
    '''    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-semibold transition ${
        active
          ? "bg-primary text-primary-foreground shadow-soft"
          : "border border-border/70 bg-card/80 text-muted-foreground hover:border-gold/40 hover:text-primary"
      }`}
    >''',
    '''    <button
      type="button"
      onClick={onClick}
      data-active={active}
    >''',
    1,
)
s = s.replace(
    '<article className="rawaj-product-card group">',
    '<article className="rawaj-owner-listing-card rawaj-product-card group">',
    1,
)
s = s.replace(
    '<section className="grid gap-3">',
    '<section className="rawaj-storefront-owner-reviews grid gap-3">',
    1,
)
metric_start = s.index('function Metric(')
panel_start = s.index('function Panel(', metric_start)
s = s[:metric_start] + s[panel_start:]
p.write_text(s)
