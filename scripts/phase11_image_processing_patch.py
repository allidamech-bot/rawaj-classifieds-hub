from pathlib import Path

path = Path("src/lib/api/listings.ts")
text = path.read_text()

old_import = '''import { buildListingImagePath, listingImagesBucket, validateImageFile } from "@/lib/api/storage";
'''
new_import = '''import { buildListingImagePath, listingImagesBucket, validateImageFile } from "@/lib/api/storage";
import { prepareListingImageForUpload } from "@/lib/listing-image-processing";
'''
if old_import not in text:
    raise SystemExit("storage import not found")
text = text.replace(old_import, new_import, 1)

old_block = '''  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data: existingListing, error: existingListingError } = await clientResult.data'''
new_block = '''  const preparedFile = await prepareListingImageForUpload(file);
  const preparedValidation = validateImageFile(preparedFile);
  if (!preparedValidation.ok) {
    return {
      ok: false,
      error: { code: "validation_error", message: preparedValidation.error! },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data: existingListing, error: existingListingError } = await clientResult.data'''
if old_block not in text:
    raise SystemExit("upload preparation insertion point not found")
text = text.replace(old_block, new_block, 1)

text = text.replace(
    'const storagePath = buildListingImagePath(userId, listing.id, file.name);',
    'const storagePath = buildListingImagePath(userId, listing.id, preparedFile.name);',
    1,
)
text = text.replace(
    '.upload(storagePath, file, {\n      cacheControl: "3600",\n      contentType: file.type,',
    '.upload(storagePath, preparedFile, {\n      cacheControl: "31536000",\n      contentType: preparedFile.type,',
    1,
)

path.write_text(text)
