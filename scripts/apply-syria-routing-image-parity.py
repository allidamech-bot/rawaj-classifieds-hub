from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    source = path.read_text()
    if old not in source:
        raise SystemExit(f"missing anchor in {path}: {old[:140]!r}")
    path.write_text(source.replace(old, new, 1))


# 1) TanStack route: keep the public URL /profile/listings/$id but make the editor
# a non-nested sibling of /profile/listings so it does not require an Outlet there.
old_route = Path("src/routes/profile/listings.$id.tsx")
new_route = Path("src/routes/profile/listings_.$id.tsx")
if not old_route.exists():
    raise SystemExit("missing Syria owner editor route")
if new_route.exists():
    raise SystemExit("non-nested owner editor route already exists")
route_source = old_route.read_text()
route_anchor = 'createFileRoute("/profile/listings/$id")'
if route_anchor not in route_source:
    raise SystemExit("missing owner editor route id anchor")
new_route.write_text(route_source.replace(route_anchor, 'createFileRoute("/profile/listings_/$id")', 1))
old_route.unlink()

# 2) Force draft recovery navigation to load a fresh document. This avoids stale
# router trees / bfcache on Safari while preserving the exact same public URL.
draft_banner = Path("src/features/listing-studio/DraftRecoveryBanner.tsx")
replace_once(draft_banner, 'import { Link } from "@tanstack/react-router";\n', "")
replace_once(
    draft_banner,
    '''                <Link
                  to="/profile/listings/$id"
                  params={{ id: draft.listing.id }}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
                >
                  {text("متابعة المسودة", "Resume draft")}
                </Link>''',
    '''                <a
                  href={`/profile/listings/${encodeURIComponent(draft.listing.id)}`}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
                >
                  {text("متابعة المسودة", "Resume draft")}
                </a>''',
)

storefront = Path("src/features/storefront/StorefrontIdentityHero.tsx")
replace_once(
    storefront,
    'import { useState, type ReactNode } from "react";',
    'import { useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";',
)
replace_once(
    storefront,
    '      {action ? <div>{action}</div> : null}\n    </section>\n  );\n}',
    '''      {action ? (
        <div onClickCapture={tone === "draft" ? handleDraftResumeNavigation : undefined}>
          {action}
        </div>
      ) : null}
    </section>
  );
}

function handleDraftResumeNavigation(event: ReactMouseEvent<HTMLDivElement>) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return;

  const destination = new URL(anchor.href, window.location.href);
  const isOwnerListingEditor =
    destination.origin === window.location.origin &&
    /^\\/profile\\/listings\\/[^/]+\\/?$/.test(destination.pathname);
  if (!isOwnerListingEditor) return;

  event.preventDefault();
  event.stopPropagation();
  window.location.assign(destination.href);
}''',
)

# 3) Normalize client image metadata from the real signature instead of trusting
# a mislabeled iPhone/generated filename or MIME declaration.
processing = Path("src/lib/listing-image-processing.ts")
source = processing.read_text()
normalize_anchor = '''export async function readListingImageDimensions(
  file: Blob,
  detectedType?: ListingImageMimeType,
): Promise<ListingImageDimensions | null> {'''
normalize_function = '''export function normalizeListingImageFileMetadata(
  file: File,
  detectedType: ListingImageMimeType,
): File {
  const extension = extensionForMimeType(detectedType);
  const currentExtension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const extensionMatches =
    detectedType === "image/jpeg"
      ? currentExtension === "jpg" || currentExtension === "jpeg"
      : currentExtension === extension;

  if (file.type === detectedType && extensionMatches) return file;

  const baseName = file.name.replace(/\\.[^.]+$/, "") || "listing-image";
  return new File([file], `${baseName}.${extension}`, {
    type: detectedType,
    lastModified: file.lastModified,
  });
}

'''
if normalize_anchor not in source:
    raise SystemExit("missing image dimension anchor")
source = source.replace(normalize_anchor, normalize_function + normalize_anchor, 1)

mismatch_block = '''  if (file.type !== detectedType) {
    return {
      ok: false,
      detectedType,
      error: "نوع الصورة الحقيقي لا يطابق نوع الملف المعلن.",
    };
  }

  let dimensions: ListingImageDimensions | null;
  try {
    dimensions = await readListingImageDimensions(file, detectedType);
'''
normalized_block = '''  const normalizedFile = normalizeListingImageFileMetadata(file, detectedType);

  let dimensions: ListingImageDimensions | null;
  try {
    dimensions = await readListingImageDimensions(normalizedFile, detectedType);
'''
if mismatch_block not in source:
    raise SystemExit("missing MIME mismatch validation block")
source = source.replace(mismatch_block, normalized_block, 1)

bitmap_anchor = 'bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });'
if bitmap_anchor not in source:
    raise SystemExit("missing validation createImageBitmap anchor")
source = source.replace(
    bitmap_anchor,
    'bitmap = await createImageBitmap(normalizedFile, { imageOrientation: "from-image" });',
    1,
)

validation_tail = '''    } finally {
      bitmap?.close();
    }
  }

  return { ok: true, detectedType, dimensions };
}'''
validation_tail_replacement = '''    } finally {
      bitmap?.close();
    }
  } else if (canUseImageElementDecoder()) {
    let objectUrl: string | null = null;
    try {
      const loaded = await loadListingImageElement(normalizedFile);
      objectUrl = loaded.objectUrl;
      if (loaded.image.naturalWidth <= 0 || loaded.image.naturalHeight <= 0) {
        return {
          ok: false,
          detectedType,
          dimensions,
          error: "أبعاد الصورة غير صالحة.",
        };
      }
    } catch {
      return {
        ok: false,
        detectedType,
        dimensions,
        error: "ملف الصورة تالف أو يتعذر فك ترميزه.",
      };
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  return { ok: true, detectedType, dimensions };
}'''
if validation_tail not in source:
    raise SystemExit("missing validation decoder tail")
source = source.replace(validation_tail, validation_tail_replacement, 1)

prepare_start = source.index("export async function prepareListingImageForUpload(file: File): Promise<File> {")
prepare_end = source.index("\nfunction readPngDimensions", prepare_start)
prepare_function = '''export async function prepareListingImageForUpload(file: File): Promise<File> {
  let detectedType: ListingImageMimeType | null = null;
  try {
    detectedType = await detectListingImageMimeType(file);
  } catch {
    return file;
  }
  if (!detectedType) return file;

  const normalizedFile = normalizeListingImageFileMetadata(file, detectedType);
  if (typeof document === "undefined") return normalizedFile;

  let bitmap: ImageBitmap | null = null;
  let image: HTMLImageElement | null = null;
  let objectUrl: string | null = null;

  try {
    let source: CanvasImageSource;
    let sourceWidth: number;
    let sourceHeight: number;

    if (typeof createImageBitmap === "function") {
      bitmap = await createImageBitmap(normalizedFile, { imageOrientation: "from-image" });
      source = bitmap;
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
    } else if (canUseImageElementDecoder()) {
      const loaded = await loadListingImageElement(normalizedFile);
      image = loaded.image;
      objectUrl = loaded.objectUrl;
      source = image;
      sourceWidth = image.naturalWidth;
      sourceHeight = image.naturalHeight;
    } else {
      return normalizedFile;
    }

    const dimensions = fitListingImageDimensions(sourceWidth, sourceHeight);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return normalizedFile;

    context.drawImage(source, 0, 0, dimensions.width, dimensions.height);
    const blob = await canvasToBlob(canvas, "image/webp", LISTING_IMAGE_QUALITY);
    if (!blob || blob.size === 0) return normalizedFile;

    const outputType = await detectListingImageMimeType(blob);
    if (!outputType) return normalizedFile;

    const baseName = normalizedFile.name.replace(/\\.[^.]+$/, "") || "listing-image";
    return new File([blob], `${baseName}.${extensionForMimeType(outputType)}`, {
      type: outputType,
      lastModified: Date.now(),
    });
  } catch {
    return normalizedFile;
  } finally {
    bitmap?.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
'''
source = source[:prepare_start] + prepare_function + source[prepare_end:]

helper_anchor = '''function readUint24Le(bytes: Uint8Array, offset: number): number {'''
helpers = '''function extensionForMimeType(type: ListingImageMimeType): "jpg" | "png" | "webp" {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  return "webp";
}

function canUseImageElementDecoder(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function"
  );
}

function loadListingImageElement(
  file: File,
): Promise<{ image: HTMLImageElement; objectUrl: string }> {
  const objectUrl = URL.createObjectURL(file);
  const image = document.createElement("img");
  image.decoding = "async";

  return new Promise((resolve, reject) => {
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image_decode_failed"));
    };
    image.src = objectUrl;
  });
}

'''
if helper_anchor not in source:
    raise SystemExit("missing image helper insertion anchor")
source = source.replace(helper_anchor, helpers + helper_anchor, 1)
processing.write_text(source)

# Keep the existing Syria image-hardening contracts and add the Saudi regression
# that proves a PNG mislabeled as JPEG is normalized safely.
test_path = Path("scripts/listing-image-content-reliability.test.mjs")
test_source = test_path.read_text()
if 'import { File } from "node:buffer";' not in test_source:
    test_source = test_source.replace(
        'import assert from "node:assert/strict";\n',
        'import assert from "node:assert/strict";\nimport { File } from "node:buffer";\n',
        1,
    )
old_signature_assert = '  assert.match(processing, /file\\.type !== detectedType/);\n});\n'
new_signature_assert = '''  assert.match(processing, /normalizeListingImageFileMetadata/);
  assert.doesNotMatch(processing, /file\\.type !== detectedType/);
});

test("mislabeled iOS and generated images are normalized to their real safe type", async () => {
  const processingModule = await importTypeScriptModule(processing);
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 640);
  view.setUint32(20, 480);

  const mislabeled = new File([bytes], "generated-image.jpeg", {
    type: "image/jpeg",
    lastModified: 123,
  });
  const validation = await processingModule.validateListingImageContent(mislabeled);
  assert.deepEqual(validation, {
    ok: true,
    detectedType: "image/png",
    dimensions: { width: 640, height: 480 },
  });

  const prepared = await processingModule.prepareListingImageForUpload(mislabeled);
  assert.equal(prepared.name, "generated-image.png");
  assert.equal(prepared.type, "image/png");
  assert.equal(prepared.lastModified, 123);
  assert.equal(prepared.size, bytes.length);
});
'''
if old_signature_assert not in test_source:
    raise SystemExit("missing image signature test anchor")
test_source = test_source.replace(old_signature_assert, new_signature_assert, 1)
test_source = test_source.replace(
    'processing.indexOf("readListingImageDimensions(file, detectedType)") <\n      processing.indexOf(\'createImageBitmap(file, { imageOrientation: "from-image" })\')',
    'processing.indexOf("readListingImageDimensions(normalizedFile, detectedType)") <\n      processing.indexOf(\'createImageBitmap(normalizedFile, { imageOrientation: "from-image" })\')',
    1,
)
test_source = test_source.replace(
    'processing.indexOf(\'createImageBitmap(file, { imageOrientation: "from-image" })\')',
    'processing.indexOf(\'createImageBitmap(normalizedFile, { imageOrientation: "from-image" })\')',
    1,
)
test_source = test_source.replace(
    '  assert.match(processing, /createImageBitmap\\(file, \\{ imageOrientation: "from-image" \\}\\)/);',
    '''  assert.match(
    processing,
    /createImageBitmap\\(normalizedFile, \\{ imageOrientation: "from-image" \\}\\)/,
  );
  assert.match(processing, /loadListingImageElement\\(normalizedFile\\)/);''',
    1,
)
test_path.write_text(test_source)
