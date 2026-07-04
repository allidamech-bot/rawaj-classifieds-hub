# Sahibinden IA Research Notes

Date: 2026-07-04

Status: corrected review artifact. Not implemented.

Purpose: extract information-architecture principles from Sahibinden-style classifieds without copying brand, text, claims, UI, paid-service language, Turkish law, or Turkey-specific geography.

## Evidence Standard

Every major conclusion below is classified as:

- `directly observed`: visible in official/public Sahibinden material.
- `strongly inferred`: supported by multiple public signals, but not fully observable from public pages.
- `RAWAJ recommendation`: design guidance adapted for RAWAJ.

## Sources Reviewed

Official/public Sahibinden sources:

- Official help: "Nasıl İlan Verebilirim?" https://yardim.sahibinden.com/hc/tr/articles/115004690274-Nas%C4%B1l-%C4%B0lan-Verebilirim
- Official help: "İlan Verme İpuçları Nelerdir?" https://yardim.sahibinden.com/hc/tr/articles/115004672353-%C4%B0lan-Verme-%C4%B0pu%C3%A7lar%C4%B1-Nelerdir
- Official help: "İlan Arama" https://yardim.sahibinden.com/hc/tr/articles/360006480094-%C4%B0lan-Arama
- Official help: "Kaç Adet Ücretsiz İlan Verebilirim?" https://yardim.sahibinden.com/hc/tr/articles/115004672373-Ka%C3%A7-Adet-%C3%9Ccretsiz-%C4%B0lan-Verebilirim
- Official Google Play app listing: https://play.google.com/store/apps/details?id=com.sahibinden&hl=en_US
- Public indexed category/navigation snippets where direct pages were partially inaccessible.

## Directly Observed IA Patterns

### Posting progression

Classification: `directly observed`.

Official help says posting starts after login, then users select the most suitable upper and lower categories, continue to other sections, write title/description, set price and product details, add media, then submit for review. This confirms that category choice precedes details and that details are category-dependent in the flow.

### Category discovery assistance

Classification: `directly observed`.

Official posting tips state that correct category selection includes both upper and lower categories. They also describe a category search entry point on the first posting page: users can type product-defining words and receive matching category suggestions. This is an important pattern for RAWAJ: hide deep complexity behind category search and guided suggestions.

### Broad top categories with many intermediate/leaf categories

Classification: `directly observed`.

Official posting tips state there are 10 upper categories and hundreds of lower/intermediate categories. The free-listing limits page exposes category families such as Emlak, Vasıta, İkinci El ve Sıfır Alışveriş, İş Makineleri & Sanayi, Özel Ders Verenler, İş İlanları, Yardımcı Arayanlar, and Hayvanlar Alemi, with further category-specific rows. This supports deep category trees, not one generic form per top category.

### Category-specific commercial and operational treatment

Classification: `directly observed`.

The free-listing limits page varies limits and fees by category and subcategory, including real estate, tourist daily rental, vehicles, motorcycles, marine vehicles, industrial machinery, agriculture machinery, private lessons, jobs, helpers, animals, accessories, and feed. RAWAJ should not copy fees, but the IA lesson is that categories are operational objects, not just labels.

### Search behavior

Classification: `directly observed`.

Official search help describes keyword search over listing/product terms, with more words narrowing results. Related help topics include detailed search and filtering options. The app listing says users can filter vehicles by preferred criteria and find nearby real estate listings.

### Main category families

Classification: `directly observed`.

Official app/help material references real estate, vehicles, shopping/new-used goods, heavy machinery/industry, private lessons, jobs, helpers, animals, services, electronics/home/garden/building materials, and vehicle subfamilies such as automobiles, off-road vehicles, motorcycles, minivans, marine vehicles, damaged vehicles, and heavy machinery.

## Strongly Inferred IA Patterns

### Category -> type -> subtype -> field schema

Classification: `strongly inferred`.

Because the posting flow asks for upper/lower categories before "price and product details," and because the platform distinguishes hundreds of intermediate/lower categories, product details are likely contextual to the selected category. RAWAJ should treat this as a strong IA pattern, but not claim exact Sahibinden form fields without direct observation.

### Transaction intent placement

Classification: `strongly inferred`.

Public category examples show intents embedded structurally in some categories: for-sale/for-rent real estate, rental vehicles, daily rental/touristic real estate, for-sale/rental heavy machinery, job listings, private lessons, helpers. RAWAJ should decide per family whether intent is a branch, a field, or a filter.

### Brand/model dependency

Classification: `strongly inferred`.

The app listing highlights vehicle brands and filtering vehicles by preferred criteria. It is reasonable to infer dependent make/model behavior in vehicles and device categories, but RAWAJ should implement its own brand/model source lists and not scrape or copy Sahibinden values.

### Complexity hidden from ordinary users

Classification: `strongly inferred`.

The public combination of top-level categories, category-search assistance, keyword search, and detailed filtering suggests complexity is hidden through search, suggestions, and progressive disclosure. RAWAJ should follow this principle.

## RAWAJ Adaptation Recommendations

Classification: `RAWAJ recommendation`.

Recommended IA chain:

```text
main category
  -> category family/group
    -> leaf category
      -> transaction intent where structurally important
        -> contextual listing fields
          -> contextual field values
            -> primary/advanced filters
```

Do not expose every level to users at once. Recommended UX:

1. User starts with search/category suggestions.
2. User picks a practical leaf category.
3. RAWAJ shows only fields relevant to that leaf.
4. Search initially shows primary filters and hides advanced filters.
5. Saved searches store stable keys, not display labels.

## What RAWAJ Should Not Copy

- Sahibinden UI, icons, labels, wording, paid services, plans, or pricing.
- Turkish real-estate authorization concepts, vehicle publishing permission rules, banking/credit options, guarantee/shipping/payment claims, or daily rental legal assumptions.
- Turkey geography, property legal values, or brand/category lists as canonical.

## Evidence Gaps

- Exact Sahibinden leaf form fields were not fully observable from public sources.
- Exact filter lists for every leaf category were not fully observable.
- Add-listing screenshots or authenticated flow details were not accessed.
- Any RAWAJ form schema must therefore be treated as an adaptation, not a copy.
