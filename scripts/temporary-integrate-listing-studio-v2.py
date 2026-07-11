from pathlib import Path


def replace_exact(value: str, old: str, new: str, label: str) -> str:
    if old not in value:
        raise RuntimeError(f"Missing {label}")
    return value.replace(old, new, 1)


# Root stylesheet order.
p = Path("src/routes/__root.tsx")
s = p.read_text()
s = replace_exact(
    s,
    'import listingStudioSignatureCss from "../listing-studio-signature.css?url";',
    'import listingStudioSignatureCss from "../listing-studio-signature.css?url";\nimport listingStudioV2Css from "../listing-studio-v2.css?url";',
    "root studio import",
)
s = replace_exact(
    s,
    '        { rel: "stylesheet", href: listingStudioSignatureCss },',
    '        { rel: "stylesheet", href: listingStudioSignatureCss },\n        { rel: "stylesheet", href: listingStudioV2Css },',
    "root studio link",
)
p.write_text(s)

# Create listing route.
p = Path("src/routes/add-listing.tsx")
s = p.read_text()
s = replace_exact(
    s,
    '''import {
  ListingStudioMessage,
  ListingStudioSection,
  ListingStudioSteps,
} from "@/features/listing-studio/listing-studio";''',
    '''import {
  ListingStudioAutosaveStatus,
  ListingStudioHero,
  ListingStudioMessage,
  ListingStudioPreview,
  ListingStudioQualityPanel,
  ListingStudioSection,
  ListingStudioSteps,
} from "@/features/listing-studio/listing-studio";''',
    "create studio imports",
)
s = replace_exact(
    s,
    '<main className="container-wide mobile-page-bottom pb-8 pt-3 sm:pt-5">',
    '<main className="rawaj-listing-studio-v2 container-wide mobile-page-bottom pb-8 pt-3 sm:pt-5">',
    "create main class",
)

top_start = s.index('        <div className="mb-4 flex flex-wrap gap-2">')
auto_start = s.index('        {autosaveState !== "idle" && (', top_start)
new_top = '''        <ListingStudioHero
          eyebrow={text("استوديو الإعلان", "Listing studio")}
          title={text("حوّل ما لديك إلى إعلان واضح وجاهز للبيع", "Turn what you have into a clear, ready-to-sell listing")}
          description={text(
            "أضف المعلومات على ثلاث خطوات قصيرة. نحفظ المسودة تلقائياً ونريك شكل الإعلان أثناء العمل.",
            "Add the essentials in three short steps. We save the draft automatically and preview the listing as you work.",
          )}
          status={
            <>
              <span>{text("3 خطوات فقط", "Only 3 steps")}</span>
              <span>{text("حفظ تلقائي للمسودة", "Automatic draft saving")}</span>
            </>
          }
          actions={
            <>
              <Link to="/">{text("الرئيسية", "Home")}</Link>
              <Link to="/listings">{text("تصفح الإعلانات", "Browse listings")}</Link>
            </>
          }
        />
        <ListingStudioSteps steps={steps.map((label) => ({ label }))} current={step} />

'''
s = s[:top_start] + new_top + s[auto_start:]

auto_start = s.index('        {autosaveState !== "idle" && (')
loading_start = s.index('        {loading ? (', auto_start)
new_autosave = '''        <ListingStudioAutosaveStatus
          state={autosaveState}
          error={autosaveError}
          lastSavedLabel={
            lastAutosavedAt
              ? `${text("آخر حفظ", "Last saved")} ${new Intl.DateTimeFormat(
                  language === "ar" ? "ar-SY" : "en-US",
                  { hour: "2-digit", minute: "2-digit" },
                ).format(new Date(lastAutosavedAt))}`
              : null
          }
          text={text}
        />

'''
s = s[:auto_start] + new_autosave + s[loading_start:]

s = replace_exact(
    s,
    '          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6">',
    '          <div className="rawaj-studio-shell">',
    "create shell",
)
s = replace_exact(
    s,
    '            <div className="space-y-4">',
    '            <div className="rawaj-studio-shell__content">',
    "create shell content",
)
s = replace_exact(
    s,
    '            <aside className="space-y-3 lg:sticky lg:top-24">',
    '            <aside className="rawaj-studio-shell__aside">',
    "create shell aside",
)

category_anchor = s.index('title={text("اختر القسم", "Choose category")}')
grid_index = s.index('className="grid grid-cols-2 gap-2 sm:grid-cols-3"', category_anchor)
s = s[:grid_index] + s[grid_index:].replace(
    'className="grid grid-cols-2 gap-2 sm:grid-cols-3"',
    'className="rawaj-studio-category-grid"',
    1,
)
button_anchor = s.index('key={item.id}', category_anchor)
class_anchor = s.index('className={`relative min-h-14', button_anchor)
s = s[:class_anchor] + 'data-selected={categoryId === item.id}\n                          ' + s[class_anchor:]

s = replace_exact(
    s,
    'className="group flex cursor-pointer flex-col items-center justify-center rounded-[1.2rem] border border-dashed border-border bg-card-warm/65 p-6 text-center text-muted-foreground transition hover:border-brand-orange/45 hover:bg-card"',
    'className="rawaj-studio-media-picker"',
    "create media picker",
)
photo_anchor = s.index("{selectedImagePreviews.map")
photo_grid = s.rfind('className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"', 0, photo_anchor)
if photo_grid < 0:
    raise RuntimeError("Missing create photo grid")
s = s[:photo_grid] + s[photo_grid:].replace(
    'className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"',
    'className="rawaj-studio-media-grid"',
    1,
)
s = replace_exact(
    s,
    'className="group relative overflow-hidden rounded-[1.05rem] border border-border/70 bg-card text-xs shadow-soft"',
    'className="rawaj-studio-media-card group text-xs"',
    "create media card",
)
s = replace_exact(
    s,
    'className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-between gap-2 rounded-[1.2rem] border border-border/80 bg-card/94 p-2.5 shadow-premium backdrop-blur-xl lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"',
    'className="rawaj-studio-action-bar"',
    "create action bar",
)

old_quality = '''              <Card title={text("جودة الإعلان", "Listing quality")}>
                <div className="text-2xl font-bold text-primary">{score}%</div>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-card-warm">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-orange to-gold transition-all"
                    style={{ width: `${score}%` }}
                  />
                </div>
              </Card>'''
new_quality = '''              <ListingStudioPreview
                imageUrl={selectedImagePreviews[0]?.url}
                title={title}
                category={category ? categoryName(category.id, category.nameAr, language) : ""}
                price={
                  priceType === "free"
                    ? text("مجاني", "Free")
                    : priceType === "contact"
                      ? text("عند التواصل", "On contact")
                      : price
                        ? `${price} SYP`
                        : ""
                }
                location={
                  locationLabel ||
                  district ||
                  (governorate
                    ? governorateName(governorate.id, governorate.nameAr, language)
                    : "")
                }
                imageCount={selectedImages.length}
                text={text}
              />
              <ListingStudioQualityPanel
                score={score}
                checks={[
                  { label: text("القسم محدد", "Category selected"), done: Boolean(categoryId) },
                  { label: text("عنوان واضح", "Clear title"), done: title.trim().length >= 8 },
                  { label: text("وصف كافٍ", "Useful description"), done: description.trim().length >= 30 },
                  { label: text("السعر مكتمل", "Price completed"), done: Boolean(price) || priceType !== "fixed" },
                  { label: text("الموقع مكتمل", "Location completed"), done: Boolean(locationNodeId) || Boolean(governorateId && district) },
                ]}
                text={text}
              />'''
s = replace_exact(s, old_quality, new_quality, "create quality panel")
p.write_text(s)

# Manage listing route.
p = Path("src/routes/profile/listings.$id.tsx")
s = p.read_text()
s = replace_exact(
    s,
    '''import {
  ListingStudioMessage,
  ListingStudioSection,
} from "@/features/listing-studio/listing-studio";''',
    '''import {
  ListingStudioHero,
  ListingStudioMessage,
  ListingStudioPreview,
  ListingStudioQualityPanel,
  ListingStudioSection,
} from "@/features/listing-studio/listing-studio";''',
    "manage studio imports",
)
s = replace_exact(
    s,
    '  const isDeletable = listing?.status === "draft" || listing?.status === "rejected";',
    '''  const isDeletable = listing?.status === "draft" || listing?.status === "rejected";
  const studioScore =
    [
      Boolean(categoryId),
      title.trim().length >= 8,
      description.trim().length >= 30,
      Boolean(price) || priceType !== "fixed",
      Boolean(locationNodeId) || Boolean(governorateId && district),
    ].filter(Boolean).length * 20;''',
    "manage score",
)
s = replace_exact(
    s,
    '<main className="container-wide mobile-page-bottom pb-8 pt-3 sm:pt-5">',
    '<main className="rawaj-listing-studio-v2 rawaj-listing-studio-v2--manage container-wide mobile-page-bottom pb-8 pt-3 sm:pt-5">',
    "manage main class",
)
hero_start = s.index('        <div className="rawaj-hero-surface mb-5')
pending_start = s.index('        {isPendingReview && (', hero_start)
hero = '''        <ListingStudioHero
          eyebrow={text("إدارة الإعلان", "Listing management")}
          title={title || text("تعديل الإعلان", "Edit listing")}
          description={text(
            "حدّث المعلومات والصور، راقب حالة الإعلان، ثم احفظه أو أعد إرساله للمراجعة عندما يصبح جاهزاً.",
            "Update information and photos, track listing status, then save or resubmit when it is ready.",
          )}
          status={
            <>
              <span>{listingStatusLabel(listing.status, language, true)}</span>
              <span>{categoryName(listing.categoryId, listing.categoryNameAr ?? undefined, language)}</span>
            </>
          }
          actions={
            <>
              {listing.status === "approved" ? (
                <Link to="/listings/$id" params={{ id: listing.id }}>
                  {text("عرض الإعلان العام", "View public listing")}
                </Link>
              ) : null}
              <Link to="/profile/listings">{text("إعلاناتي", "My listings")}</Link>
            </>
          }
        />

'''
s = s[:hero_start] + hero + s[pending_start:]
s = replace_exact(
    s,
    '        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6">',
    '        <div className="rawaj-studio-shell" data-mode="manage">',
    "manage shell",
)
s = replace_exact(
    s,
    '          <div className="space-y-4">',
    '          <div className="rawaj-studio-shell__content">',
    "manage content",
)
s = replace_exact(
    s,
    '          <aside className="space-y-3 lg:sticky lg:top-24">',
    '          <aside className="rawaj-studio-shell__aside">',
    "manage aside",
)

existing_grid_anchor = s.index("{images.map((image, index) => (")
existing_grid = s.rfind('className="grid grid-cols-2 gap-2 sm:grid-cols-3"', 0, existing_grid_anchor)
if existing_grid >= 0:
    s = s[:existing_grid] + s[existing_grid:].replace(
        'className="grid grid-cols-2 gap-2 sm:grid-cols-3"',
        'className="rawaj-studio-media-grid"',
        1,
    )
s = s.replace(
    'className="relative overflow-hidden rounded-[1.05rem] border border-border/70 bg-card p-1 shadow-soft"',
    'className="rawaj-studio-media-card p-1"',
    1,
)
s = s.replace(
    'className="group flex cursor-pointer flex-col items-center justify-center rounded-[1.1rem] border border-dashed border-border bg-card-warm/65 p-5 text-center text-muted-foreground transition hover:border-brand-orange/45 hover:bg-card"',
    'className="rawaj-studio-media-picker min-h-[9rem]"',
    1,
)
selected_anchor = s.index("{selectedImages.map((preview, index) => (")
selected_grid = s.rfind('className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3"', 0, selected_anchor)
if selected_grid >= 0:
    s = s[:selected_grid] + s[selected_grid:].replace(
        'className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3"',
        'className="rawaj-studio-media-grid mt-2"',
        1,
    )

actions_anchor = s.index('            <ListingStudioSection title={text("إجراءات", "Actions")}>')
preview = '''            <ListingStudioPreview
              imageUrl={images[0]?.publicUrl ?? selectedImages[0]?.url}
              title={title}
              category={category ? categoryName(category.id, category.nameAr, language) : ""}
              price={
                priceType === "free"
                  ? text("مجاني", "Free")
                  : priceType === "contact"
                    ? text("عند التواصل", "On contact")
                    : price
                      ? `${price} SYP`
                      : ""
              }
              location={
                district ||
                (governorate
                  ? governorateName(governorate.id, governorate.nameAr, language)
                  : "")
              }
              imageCount={images.length + selectedImages.length}
              text={text}
            />
            <ListingStudioQualityPanel
              score={studioScore}
              checks={[
                { label: text("القسم محدد", "Category selected"), done: Boolean(categoryId) },
                { label: text("عنوان واضح", "Clear title"), done: title.trim().length >= 8 },
                { label: text("وصف كافٍ", "Useful description"), done: description.trim().length >= 30 },
                { label: text("السعر مكتمل", "Price completed"), done: Boolean(price) || priceType !== "fixed" },
                { label: text("الموقع مكتمل", "Location completed"), done: Boolean(locationNodeId) || Boolean(governorateId && district) },
              ]}
              text={text}
            />
'''
s = s[:actions_anchor] + preview + s[actions_anchor:]
p.write_text(s)

# Permanent contract.
p = Path(".github/workflows/quality-gate.yml")
s = p.read_text()
anchor = '      - name: Listing Detail V2 contract\n        run: node --test scripts/listing-detail-v2.test.mjs\n'
if anchor not in s:
    raise RuntimeError("Missing Listing Detail V2 Quality Gate anchor")
if "Listing Studio V2 contract" not in s:
    s = s.replace(
        anchor,
        anchor + '\n      - name: Listing Studio V2 contract\n        run: node --test scripts/listing-studio-v2.test.mjs\n',
        1,
    )
p.write_text(s)
