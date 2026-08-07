from pathlib import Path


def edit(path: str, replacements: list[tuple[str, str]]) -> None:
    p = Path(path)
    s = p.read_text()
    for old, new in replacements:
        if old not in s:
            raise SystemExit(f"missing anchor in {path}: {old[:120]!r}")
        s = s.replace(old, new, 1)
    p.write_text(s)


editor = "src/routes/profile/listings.$id.tsx"
edit(editor, [
    (
        '  const isEditable = listing?.status === "draft" || listing?.status === "rejected";',
        '  const isEditable =\n    listing?.status === "draft" ||\n    listing?.status === "rejected" ||\n    listing?.status === "approved";',
    ),
    (
        '  }, [auth.profile?.id, id]);\n\n  function captureCurrentFormValues()',
        '  }, [auth.profile?.id, id]);\n\n'
        '  const refreshListingAfterMediaMutation = useCallback(async () => {\n'
        '    if (!auth.profile?.id) return null;\n'
        '    const result = await fetchOwnerListingDetail(auth.profile.id, id);\n'
        '    if (!result.ok) {\n'
        '      setUploadError(result.error.message);\n'
        '      return null;\n'
        '    }\n'
        '    setListing(result.data);\n'
        '    return result.data;\n'
        '  }, [auth.profile?.id, id]);\n\n'
        '  function captureCurrentFormValues()',
    ),
    (
        '    const hasChangedFields = Object.keys(patch).length > 0;\n    let savedListing = listing;',
        '    const hasChangedFields = Object.keys(patch).length > 0;\n'
        '    const needsApprovedDraftTransition =\n'
        '      listing.status === "approved" && (hasChangedFields || taxonomyChanged || attributesChanged);\n'
        '    let savedListing = listing;',
    ),
    ('    if (hasChangedFields) {', '    if (hasChangedFields || needsApprovedDraftTransition) {'),
])

p = Path(editor)
s = p.read_text()
start = s.index('  function handleImageSelection(files: FileList | null) {')
end = s.index('\n  function removeSelectedImage(entryId: string) {', start)
new_selection = '''  function handleImageSelection(files: FileList | null) {
    const nextFiles = Array.from(files ?? []);
    const current = selectedImagesRef.current;
    const capacity = Math.max(0, MAX_IMAGES - imagesRef.current.length - current.length);
    const existing = new Set(current.map((entry) => fileFingerprint(entry.file)));
    const unique = nextFiles
      .filter(
        (file, index, files) =>
          !existing.has(fileFingerprint(file)) &&
          files.findIndex((item) => fileFingerprint(item) === fileFingerprint(file)) === index,
      )
      .slice(0, capacity)
      .map((file) => ({
        id: `${fileFingerprint(file)}-${crypto.randomUUID()}`,
        file,
        state: "pending" as const,
        url: URL.createObjectURL(file),
      }));
    const next = [...current, ...unique];
    selectedImagesRef.current = next;
    setSelectedImages(next);
    if (imagesRef.current.length + current.length + nextFiles.length > MAX_IMAGES) {
      setUploadError(text("الحد الأقصى 6 صور للإعلان.", "A listing can have up to 6 photos."));
    } else {
      setUploadError(null);
    }
    if (unique.length > 0) queueMicrotask(() => void handleUploadImages());
  }
'''
s = s[:start] + new_selection + s[end:]
p.write_text(s)

edit(editor, [
    (
        '    const remaining = selectedImagesRef.current.filter((item) => item.id !== entryId);\n    selectedImagesRef.current = remaining;\n    setSelectedImages(remaining);\n  }\n\n  async function retrySelectedImage(entryId: string) {\n    await uploadSelectedImage(entryId);\n  }',
        '    const remaining = selectedImagesRef.current.filter((item) => item.id !== entryId);\n'
        '    selectedImagesRef.current = remaining;\n'
        '    setSelectedImages(remaining);\n'
        '    await refreshListingAfterMediaMutation();\n'
        '  }\n\n'
        '  async function retrySelectedImage(entryId: string) {\n'
        '    const retryEntries = selectedImagesRef.current.map((item) =>\n'
        '      item.id === entryId ? { ...item, state: "pending" as const, error: undefined } : item,\n'
        '    );\n'
        '    selectedImagesRef.current = retryEntries;\n'
        '    setSelectedImages(retryEntries);\n'
        '    await handleUploadImages();\n'
        '  }',
    ),
    (
        '      for (const entry of [...selectedImagesRef.current]) {\n        await uploadSelectedImage(entry.id);\n      }',
        '      const pendingEntries = selectedImagesRef.current.filter((entry) => entry.state === "pending");\n'
        '      for (const entry of pendingEntries) {\n'
        '        await uploadSelectedImage(entry.id);\n'
        '      }',
    ),
    (
        '      imagesRef.current = result.data;\n      setImages(result.data);',
        '      imagesRef.current = result.data;\n      setImages(result.data);\n      await refreshListingAfterMediaMutation();',
    ),
    (
        '        imagesRef.current = nextImages;\n        setImages(nextImages);',
        '        imagesRef.current = nextImages;\n        setImages(nextImages);\n        await refreshListingAfterMediaMutation();',
    ),
])

p = Path(editor)
s = p.read_text()
anchor = '        {listing.status === "draft" && (\n'
if anchor not in s:
    raise SystemExit('missing approved-warning anchor')
warning = '''        {listing.status === "approved" && (
          <div className="mb-4">
            <ListingStudioMessage tone="warning">
              {text(
                "عند حفظ أي تعديل أو تغيير صورة، سيتحول الإعلان إلى مسودة خاصة ويختفي مؤقتاً من الموقع. بعد الانتهاء اضغط «إعادة إرسال للمراجعة» ليعود للنشر بعد موافقة الإدارة.",
                "Saving any change or modifying a photo moves this listing to a private draft and temporarily removes it from the public site. When finished, choose “Resubmit for review” so it can be published again after approval.",
              )}
            </ListingStudioMessage>
          </div>
        )}

'''
s = s.replace(anchor, warning + anchor, 1)
s = s.replace('disabled={saving}', 'disabled={saving || uploading || selectedImages.length > 0}', 1)
s = s.replace('disabled={resubmitting}', 'disabled={resubmitting || uploading || selectedImages.length > 0}', 1)
s = s.replace('{text("ستظهر أولاً بعد الرفع", "Will appear first after upload")}', '{text("سيتم رفعها تلقائياً", "Uploading automatically")}', 1)
p.write_text(s)

add = Path('src/routes/add-listing.tsx')
s = add.read_text()
if 'CheckCircle2' not in s.split('\n', 8)[2]:
    s = s.replace('import { ArrowDown, ArrowUp, Camera, Info, X } from "lucide-react";', 'import { ArrowDown, ArrowUp, Camera, CheckCircle2, Info, X } from "lucide-react";', 1)
if 'const submissionSucceeded = draftListing?.status === "pending_review";' not in s:
    s = s.replace('  const canSubmit = step === 3;\n', '  const canSubmit = step === 3;\n  const submissionSucceeded = draftListing?.status === "pending_review";\n', 1)
marker = '  return (\n    <>\n      <PageHeader title={text("أضف إعلاناً", "Post a listing")} />'
if marker not in s:
    raise SystemExit('missing add-listing return anchor')
success = '''  if (submissionSucceeded && createdListingId) {
    return (
      <>
        <PageHeader title={text("تم إرسال الإعلان", "Listing submitted")} />
        <main className="container-wide mobile-page-bottom pb-10 pt-6 sm:pt-10">
          <section className="mx-auto max-w-2xl rounded-[2rem] border border-emerald-500/20 bg-card p-6 text-center shadow-soft sm:p-10">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500/12 text-emerald-600">
              <CheckCircle2 className="h-11 w-11" aria-hidden="true" />
            </div>
            <p className="mt-5 text-xs font-bold text-emerald-600">{text("تمت الخطوة الرابعة بنجاح", "Step four completed successfully")}</p>
            <h1 className="mt-2 text-2xl font-black text-foreground sm:text-3xl">{text("تم إرسال إعلانك للمراجعة بنجاح", "Your listing was submitted for review")}</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{text("سنراجع الإعلان، وسيظهر للعامة بعد موافقة الإدارة. يمكنك متابعة حالته من صفحة إعلاناتي.", "We will review the listing, and it will become public after admin approval. You can track its status from My listings.")}</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Link to="/profile/listings/$id" params={{ id: createdListingId }} className="rawaj-button-primary min-h-12 justify-center rounded-2xl px-5 py-3">{text("إدارة الإعلان", "Manage listing")}</Link>
              <Link to="/profile/listings" className="rawaj-chip min-h-12 justify-center rounded-2xl px-5 py-3 font-bold">{text("إعلاناتي", "My listings")}</Link>
            </div>
          </section>
        </main>
      </>
    );
  }

'''
s = s.replace(marker, success + marker, 1)
add.write_text(s)

edit('src/lib/api/listings.ts', [
    ('return permissionFailure("لا يمكن تعديل صور إعلان بعد اعتماده.");', 'return permissionFailure("لا يمكن تعديل صور الإعلان في حالته الحالية.");'),
    ('return status === "draft" || status === "rejected";', 'return status === "draft" || status === "rejected" || status === "approved";'),
])

worker = Path('cloudflare/worker/src/marketplace-private.ts')
s = worker.read_text()
repls = [
    ('if (!["draft", "rejected"].includes(existing.status)) {', 'if (!["draft", "rejected", "approved"].includes(existing.status)) {'),
    ('  const status = input.submit ? "pending_review" : existing.status;', '  const status =\n    input.submit ? "pending_review" : existing.status === "approved" ? "draft" : existing.status;'),
    ('if (!["draft", "rejected"].includes(listing.status)) return forbidden(cors);', 'if (!["draft", "rejected", "approved"].includes(listing.status)) return forbidden(cors);'),
]
for old,new in repls:
    if old not in s:
        raise SystemExit(f'missing worker anchor: {old}')
    s=s.replace(old,new,1)
old='if (!["draft", "rejected"].includes(listing.status)) return forbidden(cors);'
if old in s:
    s=s.replace(old,'if (!["draft", "rejected", "approved"].includes(listing.status)) return forbidden(cors);',1)
anchor='  const sortOrder = count?.count ?? 0;\n  const altAr = clean(form.get("altAr"), 200);\n  const timestamp = now();\n  const results = await env.DB.batch([\n'
if anchor not in s:
    raise SystemExit('missing worker upload transition anchor')
s=s.replace(anchor,'  const sortOrder = count?.count ?? 0;\n  const altAr = clean(form.get("altAr"), 200);\n  const timestamp = now();\n  const listingTransition =\n    listing.status === "approved"\n      ? [\n          env.DB.prepare(\n            "UPDATE listings SET status = \'draft\', updated_at = ? WHERE id = ? AND owner_id = ? AND status = \'approved\'",\n          ).bind(timestamp, listingId, auth.userId),\n        ]\n      : [];\n  const results = await env.DB.batch([\n    ...listingTransition,\n',1)
worker.write_text(s)
