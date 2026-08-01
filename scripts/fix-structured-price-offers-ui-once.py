from pathlib import Path

path = Path("src/features/communication/ConversationPriceOffers.tsx")
text = path.read_text(encoding="utf-8")
old = '''        action,
        amount,
        expectedUpdatedAt: offer.updatedAt,'''
new = '''        action,
        amount: amount ?? undefined,
        expectedUpdatedAt: offer.updatedAt,'''
if old not in text:
    raise SystemExit("counter amount marker missing")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
