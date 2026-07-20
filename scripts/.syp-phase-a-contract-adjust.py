from pathlib import Path

path = Path("scripts/syp-denomination-phase-a.test.mjs")
source = path.read_text()
old = "  assert.match(updateRpc, /price_denomination: payload\\.priceDenomination/);"
new = "  assert.match(updateRpc, /price_denomination\\s*=\\s*payload\\.priceDenomination/);"
count = source.count(old)
if count != 1:
    raise RuntimeError(f"update RPC contract: expected one match, found {count}")
path.write_text(source.replace(old, new, 1))
print("Adjusted update RPC denomination contract.")
