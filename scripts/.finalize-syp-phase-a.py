from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file_path = Path(path)
    source = file_path.read_text()
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    file_path.write_text(source.replace(old, new, 1))


replace_once(
    "src/routes/admin.pending.tsx",
    'import { ResilientImage } from "@/components/media/ResilientImage";',
    'import { ResilientImage } from "@/components/media/ResilientImage";\n'
    'import { SypClassificationQueue } from "@/features/listings/SypClassificationQueue";',
    "admin classification queue import",
)

replace_once(
    "src/routes/admin.pending.tsx",
    '      </section>\n\n      {error && hasLoaded ? (',
    '      </section>\n\n      <SypClassificationQueue />\n\n      {error && hasLoaded ? (',
    "admin classification queue render",
)

replace_once(
    "supabase/migrations/202607210001_syp_denomination_phase_a.sql",
    "    if found then\n"
    "      new.price_denomination_snapshot := coalesce(v_denomination, 'unclassified');\n"
    "    end if;\n"
    "  else\n"
    "    new.price_denomination_snapshot := 'unclassified';\n"
    "  end if;",
    "    if found then\n"
    "      new.price_denomination_snapshot := coalesce(v_denomination, 'unclassified');\n"
    "    else\n"
    "      new.price_denomination_snapshot := 'unclassified';\n"
    "    end if;\n"
    "  else\n"
    "    new.price_denomination_snapshot := 'unclassified';\n"
    "  end if;",
    "favorite snapshot fail-closed branch",
)

path = Path("scripts/syp-denomination-phase-a.test.mjs")
source = path.read_text()
source = source.replace(
    '  const owner = await readPhaseAText("src/routes/profile/listings.tsx");\n'
    '  const queue = await readPhaseAText("src/features/listings/SypClassificationQueue.tsx");',
    '  const owner = await readPhaseAText("src/routes/profile/listings.tsx");\n'
    '  const admin = await readPhaseAText("src/routes/admin.pending.tsx");\n'
    '  const queue = await readPhaseAText("src/features/listings/SypClassificationQueue.tsx");',
    1,
)
source = source.replace(
    '  assert.match(owner, /<SypClassificationQueue \\/>/);\n'
    '  assert.match(queue, /classifySypListingPrice/);',
    '  assert.match(owner, /<SypClassificationQueue \\/>/);\n'
    '  assert.match(admin, /<SypClassificationQueue \\/>/);\n'
    '  assert.match(queue, /classifySypListingPrice/);',
    1,
)
source = source.replace(
    '  assert.match(sql, /rawaj_sync_favorite_snapshot_syp_denomination/i);',
    '  assert.match(sql, /rawaj_sync_favorite_snapshot_syp_denomination/i);\n'
    '  assert.match(\n'
    '    sql,\n'
    '    /if found then[\\s\\S]*else[\\s\\S]*price_denomination_snapshot := \'unclassified\'/i,\n'
    '  );',
    1,
)
if 'const admin = await readPhaseAText("src/routes/admin.pending.tsx")' not in source:
    raise RuntimeError("admin classification contract insertion failed")
if "if found then[\\s\\S]*else" not in source:
    raise RuntimeError("favorite fail-closed contract insertion failed")
path.write_text(source)

print("Final SYP Phase A hardening applied.")
