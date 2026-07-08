from pathlib import Path

path = Path("src/routes/add-listing.tsx")
text = path.read_text(encoding="utf-8")
old = '                · {text("آخر حفظ", "Last saved")} {" "}\n'
new = '                {text("آخر حفظ", "Last saved")} {" "}\n'
if text.count(old) != 1:
    raise RuntimeError(f"expected one autosave timestamp anchor, found {text.count(old)}")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("Fixed autosave Prettier formatting")
