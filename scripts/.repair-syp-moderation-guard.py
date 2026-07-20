from pathlib import Path

MIGRATION = Path("supabase/migrations/202607210001_syp_denomination_phase_a.sql")
ROLLBACK = Path("scripts/sql/syp-denomination-phase-a-rollback.sql")
BASELINE = Path("supabase/migrations/202607200004_fix_listing_generated_column_moderation_guard.sql")
CONTRACT = Path("scripts/syp-denomination-phase-a.test.mjs")
MARKER = "create or replace function public.rawaj_protect_listing_moderation_update()"


def function_block(source: str) -> str:
    start = source.index(MARKER)
    end = source.index("\n$$;", start) + len("\n$$;")
    return source[start:end]


def replace_function(path: Path, replacement: str) -> None:
    source = path.read_text()
    current = function_block(source)
    if source.count(current) != 1:
        raise RuntimeError(f"{path}: moderation guard block is not unique")
    path.write_text(source.replace(current, replacement, 1))


baseline = function_block(BASELINE.read_text())
combined = baseline

syp_path = '''  if current_setting('rawaj.syp_denomination_write', true) = 'on' then
    if auth.uid() is null
       or (old.owner_id <> auth.uid() and not public.rawaj_current_user_can_review_listings())
    then
      raise exception 'syp_denomination_permission_denied';
    end if;

    if (to_jsonb(new) - array[
          'price_denomination', 'price_new_syp_normalized', 'updated_at',
          'search_text_normalized'
        ])
       is distinct from
       (to_jsonb(old) - array[
          'price_denomination', 'price_new_syp_normalized', 'updated_at',
          'search_text_normalized'
        ])
    then
      raise exception 'syp_denomination_unsafe_update';
    end if;

    return new;
  end if;

'''
combined = combined.replace("begin\n", "begin\n" + syp_path, 1)

replacements = [
    (
        "array['price', 'updated_at', 'search_text_normalized']",
        "array['price', 'updated_at', 'search_text_normalized', 'price_new_syp_normalized']",
        2,
        "price-drop generated columns",
    ),
    (
        "array['reserved_at', 'updated_at', 'search_text_normalized']",
        "array['reserved_at', 'updated_at', 'search_text_normalized', 'price_new_syp_normalized']",
        2,
        "reservation generated columns",
    ),
    (
        "'is_featured', 'featured_until', 'updated_at', 'search_text_normalized'",
        "'is_featured', 'featured_until', 'updated_at', 'search_text_normalized',\n"
        "          'price_new_syp_normalized'",
        2,
        "promotion generated columns",
    ),
    (
        "'expires_at', 'search_text_normalized'",
        "'expires_at', 'search_text_normalized', 'price_new_syp_normalized'",
        2,
        "review generated columns",
    ),
]
for old, new, expected, label in replacements:
    count = combined.count(old)
    if count != expected:
        raise RuntimeError(f"{label}: expected {expected} matches, found {count}")
    combined = combined.replace(old, new)

replace_function(MIGRATION, combined)
replace_function(ROLLBACK, baseline)

contract = CONTRACT.read_text()
needle = "  assert.match(sql, /rawaj_sync_favorite_snapshot_syp_denomination/i);"
addition = '''  assert.match(sql, /rawaj_sync_favorite_snapshot_syp_denomination/i);
  assert.match(sql, /rawaj\.owner_reservation_write/i);
  assert.match(sql, /rawaj\.promotion_moderation_write/i);
  assert.match(
    sql,
    /expires_at', 'search_text_normalized', 'price_new_syp_normalized'/i,
  );'''
if contract.count(needle) != 1:
    raise RuntimeError("Phase A SQL contract anchor is not unique")
contract = contract.replace(needle, addition, 1)
rollback_needle = "  assert.doesNotMatch(rollback, /Required follow-up: redeploy/i);"
rollback_addition = '''  assert.match(rollback, /rawaj\.owner_reservation_write/i);
  assert.match(rollback, /rawaj\.promotion_moderation_write/i);
  assert.match(rollback, /expires_at', 'search_text_normalized'/i);
  assert.doesNotMatch(rollback, /price_new_syp_normalized/);
  assert.doesNotMatch(rollback, /Required follow-up: redeploy/i);'''
if contract.count(rollback_needle) != 1:
    raise RuntimeError("Phase A rollback contract anchor is not unique")
contract = contract.replace(rollback_needle, rollback_addition, 1)
CONTRACT.write_text(contract)

print("Combined the latest moderation guard with governed SYP write paths.")
