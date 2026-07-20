from __future__ import annotations

from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    Path(path).write_text(content)


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return source.replace(old, new, 1)


def extract_function(source: str, marker: str) -> str:
    start = source.index(marker)
    end = source.index("\n$$;", start) + len("\n$$;")
    return source[start:end]


def patch_owner_listings_page() -> None:
    path = "src/routes/profile/listings.tsx"
    source = read(path)
    source = replace_once(
        source,
        'import { PlaceholderArt } from "@/components/PlaceholderArt";',
        'import { PlaceholderArt } from "@/components/PlaceholderArt";\n'
        'import { SypClassificationQueue } from "@/features/listings/SypClassificationQueue";',
        "owner listings classification import",
    )
    source = replace_once(
        source,
        "        />\n\n        {latestDraft ? (",
        "        />\n\n        <SypClassificationQueue />\n\n        {latestDraft ? (",
        "owner listings classification queue",
    )
    write(path, source)


def patch_edit_route() -> None:
    path = "src/routes/profile/listings.$id.tsx"
    source = read(path)
    source = replace_once(
        source,
        'import { categoryName, governorateName } from "@/lib/i18n";',
        'import { categoryName, formatPriceLocalized, governorateName } from "@/lib/i18n";\n'
        'import {\n'
        '  createClassifiedSypPrice,\n'
        '  requiresSypDenomination,\n'
        '  type SypPriceDenomination,\n'
        '} from "@/lib/syp-denomination";',
        "edit route SYP imports",
    )
    source = replace_once(
        source,
        "  price: number | null;\n  priceType: PriceType;",
        "  price: number | null;\n  priceDenomination: SypPriceDenomination;\n  priceType: PriceType;",
        "edit form denomination field",
    )
    source = replace_once(
        source,
        '  const [price, setPrice] = useState("");\n  const [priceType, setPriceType] = useState<PriceType>("fixed");',
        '  const [price, setPrice] = useState("");\n'
        '  const [priceDenomination, setPriceDenomination] =\n'
        '    useState<SypPriceDenomination>("unclassified");\n'
        '  const [priceType, setPriceType] = useState<PriceType>("fixed");',
        "edit denomination state",
    )
    source = replace_once(
        source,
        '        priceReady: priceType !== "fixed" || Number(price) > 0,',
        '        priceReady:\n'
        '          priceType !== "fixed" ||\n'
        '          (Number(price) > 0 &&\n'
        '            (!requiresSypDenomination(Number(price), priceType) ||\n'
        '              priceDenomination !== "unclassified")),',
        "edit quality denomination readiness",
    )
    source = replace_once(
        source,
        "      price,\n      priceType,",
        "      price,\n      priceDenomination,\n      priceType,",
        "edit quality dependency",
    )
    source = replace_once(
        source,
        "      price: loadedListing.price,\n      priceType: loadedListing.priceType,",
        "      price: loadedListing.price,\n"
        "      priceDenomination: loadedListing.priceDenomination,\n"
        "      priceType: loadedListing.priceType,",
        "edit loaded denomination",
    )
    source = replace_once(
        source,
        "    setPrice(loadedValues.price?.toString() ?? \"\");\n    setPriceType(loadedValues.priceType);",
        "    setPrice(loadedValues.price?.toString() ?? \"\");\n"
        "    setPriceDenomination(loadedValues.priceDenomination);\n"
        "    setPriceType(loadedValues.priceType);",
        "edit hydrate denomination state",
    )
    source = replace_once(
        source,
        "      price: price.trim() === \"\" ? null : Number(price),\n      priceType,",
        "      price: price.trim() === \"\" ? null : Number(price),\n"
        "      priceDenomination,\n"
        "      priceType,",
        "edit capture denomination",
    )
    source = replace_once(
        source,
        "  if (current.price !== initial.price) patch.price = current.price;\n"
        "  if (current.priceType !== initial.priceType) patch.priceType = current.priceType;",
        "  if (current.price !== initial.price) patch.price = current.price;\n"
        "  if (current.priceDenomination !== initial.priceDenomination) {\n"
        "    patch.priceDenomination = current.priceDenomination;\n"
        "  }\n"
        "  if (current.priceType !== initial.priceType) patch.priceType = current.priceType;",
        "edit denomination patch",
    )
    source = replace_once(
        source,
        "  if (values.price !== null && (!Number.isFinite(values.price) || values.price < 0)) {\n"
        '    return { ok: false, message: text("أدخل سعرًا صحيحًا.", "Enter a valid price.") };\n'
        "  }",
        "  if (values.price !== null && (!Number.isFinite(values.price) || values.price < 0)) {\n"
        '    return { ok: false, message: text("أدخل سعرًا صحيحًا.", "Enter a valid price.") };\n'
        "  }\n"
        "  if (\n"
        "    requiresSypDenomination(values.price, values.priceType) &&\n"
        '    values.priceDenomination === "unclassified"\n'
        "  ) {\n"
        "    return {\n"
        "      ok: false,\n"
        "      message: text(\n"
        '        "حدد ما إذا كان السعر بالليرة القديمة أو الجديدة.",\n'
        '        "Choose whether the price is in old or new Syrian pounds.",\n'
        "      ),\n"
        "    };\n"
        "  }",
        "edit denomination validation",
    )
    price_type_block = '''                <Field label={text("نوع السعر", "Price type")}>
                  <select
                    value={priceType}
                    onChange={(e) => setPriceType(e.target.value as PriceType)}
                    className="input"
                    disabled={!isEditable}
                  >
                    <option value="fixed">{text("ثابت", "Fixed")}</option>
                    <option value="negotiable">{text("قابل للتفاوض", "Negotiable")}</option>
                    <option value="contact">{text("عند التواصل", "On contact")}</option>
                    <option value="free">{text("مجاني", "Free")}</option>
                    <option value="exchange">{text("للمبادلة", "Exchange")}</option>
                  </select>
                </Field>'''
    denomination_block = price_type_block + '''
                {(priceType === "fixed" || priceType === "negotiable") && price ? (
                  <Field label={text("وحدة الليرة السورية", "Syrian pound denomination")}>
                    <select
                      value={priceDenomination}
                      onChange={(event) =>
                        setPriceDenomination(event.target.value as SypPriceDenomination)
                      }
                      className="input"
                      disabled={!isEditable}
                    >
                      <option value="unclassified">
                        {text("اختر القديمة أو الجديدة", "Choose old or new")}
                      </option>
                      <option value="old">{text("ليرة سورية قديمة", "Old Syrian pounds")}</option>
                      <option value="new">{text("ليرة سورية جديدة", "New Syrian pounds")}</option>
                    </select>
                  </Field>
                ) : null}'''
    source = replace_once(source, price_type_block, denomination_block, "edit denomination selector")
    source = replace_once(
        source,
        "                    : price\n                      ? `${price} SYP`\n                      : \"\"",
        "                    : price\n"
        "                      ? formatManagedSypPrice(price, priceType, priceDenomination, language)\n"
        "                      : \"\"",
        "edit preview dual price",
    )
    field_marker = "function Field({"
    helper = '''function formatManagedSypPrice(
  value: string,
  priceType: PriceType,
  denomination: SypPriceDenomination,
  language: Language,
) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  const dual = createClassifiedSypPrice(amount, denomination);
  if (!dual) {
    return `${formatPriceLocalized(amount, priceType, language, "SYP")} · ${
      language === "ar" ? "الوحدة غير مصنفة" : "Unclassified denomination"
    }`;
  }
  const newLabel = formatPriceLocalized(dual.newSyp, priceType, language, "SYP");
  const oldLabel = formatPriceLocalized(dual.oldSyp, "fixed", language, "SYP");
  return language === "ar" ? `${newLabel} · يعادل ${oldLabel} قديمة` : `${newLabel} · ${oldLabel} old`;
}

'''
    source = replace_once(source, field_marker, helper + field_marker, "edit preview helper")
    # Both save and resubmit callbacks capture this state.
    source = source.replace("    price,\n    priceType,", "    price,\n    priceDenomination,\n    priceType,")
    write(path, source)


def patch_detail_route() -> None:
    path = "src/routes/listings.$id.tsx"
    source = read(path)
    source = replace_once(
        source,
        'import { UnavailableListingRecovery } from "@/features/listing-detail/UnavailableListingRecovery";',
        'import { UnavailableListingRecovery } from "@/features/listing-detail/UnavailableListingRecovery";\n'
        'import { SypPriceDisplay } from "@/features/listings/SypPriceDisplay";',
        "detail SYP display import",
    )
    source = replace_once(
        source,
        'import { categoryName, formatPriceLocalized } from "@/lib/i18n";',
        'import { categoryName } from "@/lib/i18n";',
        "detail remove raw formatter import",
    )
    source = replace_once(
        source,
        "      listing.price === null ||\n      ![\"fixed\", \"negotiable\"].includes(listing.priceType)",
        "      listing.price === null ||\n"
        "      listing.priceNewSypNormalized === null ||\n"
        "      ![\"fixed\", \"negotiable\"].includes(listing.priceType)",
        "detail alert classification guard",
    )
    source = replace_once(
        source,
        '        nameAr: "نتائج مشابهة بسعر " + listing.price,',
        '        nameAr: "نتائج مشابهة بسعر " + listing.priceNewSypNormalized,',
        "detail alert normalized name",
    )
    source = replace_once(
        source,
        "          priceMax: listing.price,",
        "          priceMax: listing.priceNewSypNormalized,",
        "detail alert normalized maximum",
    )
    old_component = '''function PriceDisplay({
  listing,
  language,
  text,
}: {
  listing: ClassifiedListing;
  language: Language;
  text: (ar: string, en: string) => string;
}) {
  return (
    <div className="rawaj-detail-price">
      <span>{text("السعر", "Price")}</span>
      <strong>
        {formatPriceLocalized(listing.price ?? 0, listing.priceType, language, listing.currency)}
      </strong>
    </div>
  );
}'''
    new_component = '''function PriceDisplay({
  listing,
  text,
}: {
  listing: ClassifiedListing;
  language: Language;
  text: (ar: string, en: string) => string;
}) {
  return (
    <div className="rawaj-detail-price">
      <span>{text("السعر", "Price")}</span>
      <SypPriceDisplay listing={listing} />
    </div>
  );
}'''
    source = replace_once(source, old_component, new_component, "detail dual price component")
    write(path, source)


def patch_migration() -> None:
    path = "supabase/migrations/202607210001_syp_denomination_phase_a.sql"
    source = read(path)
    marker = "-- Phase A completion: normalized search, governed price history, and snapshot metadata."
    if marker in source:
        raise RuntimeError("Phase A completion SQL already present")

    search_base = read("supabase/migrations/202607190042_dynamic_listing_search_page_v1.sql")
    search_function = extract_function(
        search_base,
        "create or replace function public.rawaj_public_listing_search_page_v1(",
    )
    search_function = search_function.replace(
        "public.rawaj_public_listing_search_page_v1(",
        "public.rawaj_public_listing_search_page_v1_impl(",
        1,
    )
    search_function = replace_once(
        search_function,
        "      listing_row.price,",
        "      listing_row.price_new_syp_normalized as price,",
        "normalized search candidate price",
    )
    search_function = replace_once(
        search_function,
        "and (p_price_min is null or listing_row.price >= p_price_min)",
        "and (p_price_min is null or listing_row.price_new_syp_normalized >= p_price_min)",
        "normalized search minimum",
    )
    search_function = replace_once(
        search_function,
        "and (p_price_max is null or listing_row.price <= p_price_max)",
        "and (p_price_max is null or listing_row.price_new_syp_normalized <= p_price_max)",
        "normalized search maximum",
    )

    price_drop_base = read("supabase/migrations/202607100009_listing_price_drop_contract.sql")
    reduce_function = extract_function(
        price_drop_base,
        "create or replace function public.rawaj_owner_reduce_listing_price(",
    )
    reduce_function = replace_once(
        reduce_function,
        "  if p_new_price is null",
        "  if v_listing.price_denomination not in ('old', 'new')\n"
        "     or v_listing.price_new_syp_normalized is null\n"
        "  then\n"
        "    raise exception 'syp_price_denomination_required';\n"
        "  end if;\n\n"
        "  if p_new_price is null",
        "price drop classification guard",
    )
    reduce_function = replace_once(
        reduce_function,
        "    new_price,\n    currency",
        "    new_price,\n"
        "    currency,\n"
        "    old_price_denomination,\n"
        "    new_price_denomination",
        "price drop denomination columns",
    )
    reduce_function = replace_once(
        reduce_function,
        "    p_new_price,\n    'SYP'",
        "    p_new_price,\n"
        "    'SYP',\n"
        "    v_listing.price_denomination,\n"
        "    v_listing.price_denomination",
        "price drop denomination values",
    )
    reduce_function = replace_once(
        reduce_function,
        "        'new_price', p_new_price,",
        "        'new_price', p_new_price,\n"
        "        'price_denomination', v_listing.price_denomination,",
        "price drop denomination audit",
    )

    offers_function = extract_function(
        price_drop_base,
        "create or replace function public.rawaj_get_active_price_drop_offers(",
    )
    offers_function = replace_once(
        offers_function,
        "      c.new_price,\n      c.created_at",
        "      c.new_price,\n"
        "      c.old_price_new_syp_normalized,\n"
        "      c.new_price_new_syp_normalized,\n"
        "      c.created_at",
        "price drop normalized history select",
    )
    offers_function = replace_once(
        offers_function,
        "    and l.price = d.new_price\n"
        "    and d.new_price > 0",
        "    and l.price_new_syp_normalized = d.new_price_new_syp_normalized\n"
        "    and d.old_price_new_syp_normalized is not null\n"
        "    and d.new_price_new_syp_normalized is not null\n"
        "    and d.new_price > 0",
        "price drop normalized active match",
    )

    snapshot_trigger = '''create or replace function public.rawaj_sync_favorite_snapshot_syp_denomination()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_denomination text;
begin
  if new.currency_snapshot = 'SYP' and new.price_snapshot is not null then
    select l.price_denomination
      into v_denomination
    from public.listings l
    where l.id = new.listing_id
      and l.price is not distinct from new.price_snapshot
      and l.currency is not distinct from new.currency_snapshot;

    if found then
      new.price_denomination_snapshot := coalesce(v_denomination, 'unclassified');
    end if;
  else
    new.price_denomination_snapshot := 'unclassified';
  end if;
  return new;
end;
$$;

revoke all on function public.rawaj_sync_favorite_snapshot_syp_denomination() from public, anon, authenticated;

drop trigger if exists rawaj_sync_favorite_snapshot_syp_denomination
  on public.favorite_listing_snapshots;
create trigger rawaj_sync_favorite_snapshot_syp_denomination
before insert or update of listing_id, price_snapshot, currency_snapshot
on public.favorite_listing_snapshots
for each row execute function public.rawaj_sync_favorite_snapshot_syp_denomination();'''

    completion = f'''\n\n{marker}\n\n{search_function}\n\nrevoke all on function public.rawaj_public_listing_search_page_v1_impl(\n  text[], jsonb, uuid, uuid[], numeric, numeric, text, text, text, boolean, text, jsonb, integer\n) from public, anon, authenticated;\n\n{reduce_function}\n\n{offers_function}\n\n{snapshot_trigger}\n'''
    source = replace_once(source, "\nnotify pgrst, 'reload schema';", completion + "\nnotify pgrst, 'reload schema';", "migration completion insertion")
    write(path, source)


def patch_rollback() -> None:
    path = "scripts/sql/syp-denomination-phase-a-rollback.sql"
    source = read(path)

    owner_base = read("supabase/migrations/202607090002_owner_update_rpc_runtime_v2.sql")
    draft_base = read("supabase/migrations/202607140002_idempotent_owner_draft_creation.sql")
    submit_base = read("supabase/migrations/202607190036_dynamic_listing_submit_guard_v1.sql")
    price_base = read("supabase/migrations/202607100009_listing_price_drop_contract.sql")
    search_base = read("supabase/migrations/202607190042_dynamic_listing_search_page_v1.sql")

    restores = [
        extract_function(owner_base, "create or replace function public.rawaj_owner_update_listing("),
        extract_function(draft_base, "create or replace function public.rawaj_create_owner_draft_v2("),
        extract_function(submit_base, "create or replace function public.rawaj_submit_listing_for_review("),
        extract_function(price_base, "create or replace function public.rawaj_protect_listing_moderation_update()"),
        extract_function(price_base, "create or replace function public.rawaj_owner_reduce_listing_price("),
        extract_function(price_base, "create or replace function public.rawaj_get_active_price_drop_offers("),
    ]
    search_restore = extract_function(
        search_base,
        "create or replace function public.rawaj_public_listing_search_page_v1(",
    ).replace(
        "public.rawaj_public_listing_search_page_v1(",
        "public.rawaj_public_listing_search_page_v1_impl(",
        1,
    )
    restores.append(search_restore)
    restore_sql = "\n\n".join(restores)

    insertion = f'''drop trigger if exists rawaj_sync_favorite_snapshot_syp_denomination
  on public.favorite_listing_snapshots;
drop function if exists public.rawaj_sync_favorite_snapshot_syp_denomination();

-- Restore every function replaced by Phase A before dropping additive columns.
{restore_sql}

'''
    source = replace_once(
        source,
        "drop function if exists public.rawaj_list_unclassified_syp_prices();\n\n",
        "drop function if exists public.rawaj_list_unclassified_syp_prices();\n\n" + insertion,
        "rollback function restore insertion",
    )
    source = source.replace(
        "\n-- Required follow-up: redeploy the pre-Phase-A function definitions from the baseline\n"
        "-- migration bundle before accepting writes. This script intentionally preserves the\n"
        "-- rollback backup instead of discarding classification evidence.\n",
        "\n-- The rollback backup is intentionally retained until verification is complete.\n",
    )
    write(path, source)


def patch_contracts() -> None:
    path = "scripts/syp-denomination-phase-a.test.mjs"
    source = read(path)
    addition = r'''

test("Phase A edit, detail, queue, and SEO surfaces use explicit denomination", () => {
  const edit = read("src/routes/profile/listings.$id.tsx");
  const detail = read("src/routes/listings.$id.tsx");
  const owner = read("src/routes/profile/listings.tsx");
  const queue = read("src/features/listings/SypClassificationQueue.tsx");
  const structured = read("src/lib/listing-structured-data.ts");

  assert.match(edit, /priceDenomination: SypPriceDenomination/);
  assert.match(edit, /requiresSypDenomination\(values\.price, values\.priceType\)/);
  assert.match(edit, /patch\.priceDenomination = current\.priceDenomination/);
  assert.match(detail, /listing\.priceNewSypNormalized === null/);
  assert.match(detail, /priceMax: listing\.priceNewSypNormalized/);
  assert.match(detail, /<SypPriceDisplay listing=\{listing\}/);
  assert.match(owner, /<SypClassificationQueue \/>/);
  assert.match(queue, /classifySypListingPrice/);
  assert.match(structured, /listing\.priceNewSypNormalized/);
});

test("Phase A normalized search and price history never compare mixed raw SYP", () => {
  const sql = read("supabase/migrations/202607210001_syp_denomination_phase_a.sql");
  assert.match(sql, /listing_row\.price_new_syp_normalized as price/i);
  assert.match(sql, /listing_row\.price_new_syp_normalized >= p_price_min/i);
  assert.match(sql, /listing_row\.price_new_syp_normalized <= p_price_max/i);
  assert.match(sql, /v_listing\.price_denomination not in \('old', 'new'\)/i);
  assert.match(sql, /old_price_denomination/i);
  assert.match(sql, /new_price_denomination/i);
  assert.match(sql, /l\.price_new_syp_normalized = d\.new_price_new_syp_normalized/i);
  assert.match(sql, /rawaj_sync_favorite_snapshot_syp_denomination/i);
});

test("Phase A rollback restores replaced functions before dropping columns", () => {
  const rollback = read("scripts/sql/syp-denomination-phase-a-rollback.sql");
  assert.match(rollback, /create or replace function public\.rawaj_owner_update_listing\(/i);
  assert.match(rollback, /create or replace function public\.rawaj_create_owner_draft_v2\(/i);
  assert.match(rollback, /create or replace function public\.rawaj_submit_listing_for_review\(/i);
  assert.match(rollback, /create or replace function public\.rawaj_owner_reduce_listing_price\(/i);
  assert.match(rollback, /create or replace function public\.rawaj_public_listing_search_page_v1_impl\(/i);
  assert.doesNotMatch(rollback, /Required follow-up: redeploy/i);
});
'''
    if "Phase A edit, detail, queue, and SEO surfaces" in source:
        raise RuntimeError("completion contracts already present")
    write(path, source + addition)


patch_owner_listings_page()
patch_edit_route()
patch_detail_route()
patch_migration()
patch_rollback()
patch_contracts()
print("Completed remaining governed SYP Phase A integrations.")
