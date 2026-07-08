from pathlib import Path

path = Path("src/routes/listings.$id.tsx")
text = path.read_text(encoding="utf-8")

old_import = 'import { PageHeader } from "@/components/PageHeader";\n'
new_import = (
    'import { PageHeader } from "@/components/PageHeader";\n'
    'import { UnavailableListingRecovery } from "@/features/listing-detail/UnavailableListingRecovery";\n'
)
if text.count(old_import) != 1:
    raise RuntimeError(f"import anchor count={text.count(old_import)}")
text = text.replace(old_import, new_import, 1)

old_state = '''  notFoundComponent: () => (
    <ListingState
      titleAr="تفاصيل الإعلان"
      titleEn="Listing details"
      bodyAr="هذا الإعلان غير متاح للعرض العام أو لم تتم الموافقة عليه."
      bodyEn="This listing is unavailable publicly or has not been approved."
    />
  ),
'''
new_state = '  notFoundComponent: UnavailableListingRecovery,\n'
if text.count(old_state) != 1:
    raise RuntimeError(f"notFound anchor count={text.count(old_state)}")
text = text.replace(old_state, new_state, 1)

path.write_text(text, encoding="utf-8")
print("Applied unavailable listing recovery")
