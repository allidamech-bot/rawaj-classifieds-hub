import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const first = source.indexOf(before);
  if (first === -1) throw new Error(`Missing expected source in ${path}: ${before.slice(0, 100)}`);
  if (source.indexOf(before, first + before.length) !== -1) {
    throw new Error(`Expected one match in ${path}: ${before.slice(0, 100)}`);
  }
  await writeFile(path, source.slice(0, first) + after + source.slice(first + before.length));
}

await replaceOnce(
  "src/routes/login.tsx",
  `    if (mode === "register") {
      setMessage(
        result.data.session
          ? text(
              "تم إنشاء الحساب ويمكنك متابعة إدارة إعلاناتك ورسائلك.",
              "Account created. You can continue managing your listings and messages.",
            )
          : text(
              "تم إرسال رابط تفعيل الحساب إلى بريدك الإلكتروني. افتح البريد واضغط على رابط التفعيل لإكمال إنشاء الحساب. إذا لم تجد الرسالة خلال دقائق، تحقق من مجلد الرسائل غير المرغوبة / Spam.",
              "We sent an account activation link to your email. Open your inbox and click the activation link to complete account setup. If you do not see it within a few minutes, check your Spam or Junk folder.",
            ),
      );
      return;
    }
`,
  `    if (mode === "register") {
      if (result.data.session) {
        setMessage(
          text(
            "تم إنشاء الحساب. جارٍ إدخالك إلى رواج.",
            "Account created. Opening RAWAJ now.",
          ),
        );
        void navigate({ to: returnTo });
        return;
      }

      setMessage(
        text(
          "تم إرسال رابط تفعيل الحساب إلى بريدك الإلكتروني. افتح البريد واضغط على رابط التفعيل لإكمال إنشاء الحساب. إذا لم تجد الرسالة خلال دقائق، تحقق من مجلد الرسائل غير المرغوبة / Spam.",
          "We sent an account activation link to your email. Open your inbox and click the activation link to complete account setup. If you do not see it within a few minutes, check your Spam or Junk folder.",
        ),
      );
      return;
    }
`,
);

await replaceOnce(
  "src/routes/auth.callback.tsx",
  `    let completionTimer: ReturnType<typeof setTimeout> | undefined;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
`,
  `    let completionTimer: ReturnType<typeof setTimeout> | undefined;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribeAuth: (() => void) | undefined;
`,
);

await replaceOnce(
  "src/routes/auth.callback.tsx",
  `      const { data: listener } = client.auth.onAuthStateChange((event, session) => {
        if (cancelled || !session) return;
        if (event === "PASSWORD_RECOVERY") observedRecoveryEvent = true;
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          finish(observedRecoveryEvent || event === "PASSWORD_RECOVERY");
        }
      });
`,
  `      const { data: listener } = client.auth.onAuthStateChange((event, session) => {
        if (cancelled || !session) return;
        if (event === "PASSWORD_RECOVERY") observedRecoveryEvent = true;
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          finish(observedRecoveryEvent || event === "PASSWORD_RECOVERY");
        }
      });
      unsubscribeAuth = () => listener.subscription.unsubscribe();
`,
);

await replaceOnce(
  "src/routes/auth.callback.tsx",
  `      clearTimeout(completionTimer);
      clearTimeout(expiryTimer);
`,
  `      clearTimeout(completionTimer);
      clearTimeout(expiryTimer);
      unsubscribeAuth?.();
`,
);

await writeFile(
  "src/lib/api/listing-image-order.ts",
  `import { fetchListingImages } from "@/lib/api/listings";
import { getClient, mapError, rowNumber, rowString } from "@/lib/api/shared";
import type { ClassifiedsResult, ListingImage } from "@/lib/classifieds-types";

export interface ListingImageOrderUpdate {
  id: string;
  sortOrder: number;
}

export async function reorderListingImages(
  userId: string | null,
  listingId: string,
  order: ListingImageOrderUpdate[],
): Promise<ClassifiedsResult<ListingImage[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لترتيب صور الإعلان." },
    };
  }

  const cleanListingId = listingId.trim();
  if (!cleanListingId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }

  const normalized = order.map((item) => ({ id: item.id.trim(), sortOrder: item.sortOrder }));
  const uniqueIds = new Set(normalized.map((item) => item.id));
  if (
    normalized.some(
      (item) => !item.id || !Number.isInteger(item.sortOrder) || item.sortOrder < 0,
    ) || uniqueIds.size !== normalized.length
  ) {
    return {
      ok: false,
      error: { code: "validation_error", message: "ترتيب الصور غير صالح." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const client = clientResult.data;

  const { data: listing, error: listingError } = await client
    .from("listings")
    .select("id, owner_id, status")
    .eq("id", cleanListingId)
    .eq("owner_id", userId)
    .in("status", ["draft", "rejected"])
    .maybeSingle();
  if (listingError) return { ok: false, error: mapError(listingError, "listing_image_reorder") };
  if (!listing) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا يمكن ترتيب صور هذا الإعلان حالياً." },
    };
  }

  const { data: currentRows, error: readError } = await client
    .from("listing_images")
    .select("id, sort_order")
    .eq("listing_id", cleanListingId)
    .order("sort_order");
  if (readError) return { ok: false, error: mapError(readError, "listing_image_reorder") };

  const current = ((currentRows ?? []) as Record<string, unknown>[]).map((row) => ({
    id: rowString(row, "id"),
    sortOrder: rowNumber(row, "sort_order"),
  }));
  const currentIds = new Set(current.map((item) => item.id));
  if (
    current.length !== normalized.length ||
    normalized.some((item) => !currentIds.has(item.id))
  ) {
    return {
      ok: false,
      error: {
        code: "status_mismatch",
        message: "تغيّرت صور الإعلان. أعد تحميل الصفحة ثم حاول ترتيبها من جديد.",
        operation: "listing_image_reorder",
      },
    };
  }

  const originalOrder = new Map(current.map((item) => [item.id, item.sortOrder] as const));
  const updatedIds: string[] = [];

  for (const item of normalized) {
    const { data: updated, error: updateError } = await client
      .from("listing_images")
      .update({ sort_order: item.sortOrder })
      .eq("id", item.id)
      .eq("listing_id", cleanListingId)
      .select("id")
      .maybeSingle();

    if (updateError || !updated) {
      for (const updatedId of updatedIds) {
        const previousSortOrder = originalOrder.get(updatedId);
        if (previousSortOrder === undefined) continue;
        await client
          .from("listing_images")
          .update({ sort_order: previousSortOrder })
          .eq("id", updatedId)
          .eq("listing_id", cleanListingId);
      }

      return {
        ok: false,
        error: updateError
          ? mapError(updateError, "listing_image_reorder")
          : {
              code: "permission_denied",
              message: "لم يتم حفظ ترتيب الصور. أعد المحاولة.",
              operation: "listing_image_reorder",
            },
      };
    }
    updatedIds.push(item.id);
  }

  return fetchListingImages(cleanListingId);
}
`,
);

await replaceOnce(
  "src/lib/classifieds-api.ts",
  `export * from "@/lib/api/listing-lifecycle";
`,
  `export * from "@/lib/api/listing-lifecycle";
export * from "@/lib/api/listing-image-order";
`,
);

await replaceOnce(
  "src/routes/add-listing.tsx",
  `import { Camera, Info, X } from "lucide-react";
`,
  `import { ArrowDown, ArrowUp, Camera, Info, X } from "lucide-react";
`,
);

await replaceOnce(
  "src/routes/add-listing.tsx",
  `  fetchPublicGovernorates,
  submitOwnerListingForReview,
`,
  `  fetchPublicGovernorates,
  reorderListingImages,
  submitOwnerListingForReview,
`,
);

await replaceOnce(
  "src/routes/add-listing.tsx",
  `  const [imageSelectionMessage, setImageSelectionMessage] = useState<string | null>(null);
`,
  `  const [imageSelectionMessage, setImageSelectionMessage] = useState<string | null>(null);
  const [reorderingImages, setReorderingImages] = useState(false);
`,
);

await replaceOnce(
  "src/routes/add-listing.tsx",
  `  async function retrySelectedImage(id: string) {
`,
  `  async function moveSelectedImage(id: string, direction: -1 | 1) {
    if (submittingRef.current || reorderingImages) return;
    const current = selectedImagesRef.current;
    if (current.some((entry) => entry.state === "uploading")) return;
    const index = current.findIndex((entry) => entry.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return;

    const previous = [...current];
    const next = [...current];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    selectedImagesRef.current = next;
    setSelectedImages(next);

    const draft = draftListingRef.current;
    const persistedOrder = next.flatMap((entry, sortOrder) =>
      entry.uploadedImage ? [{ id: entry.uploadedImage.id, sortOrder }] : [],
    );
    if (!draft || persistedOrder.length === 0) return;

    setReorderingImages(true);
    const result = await reorderListingImages(auth.profile?.id ?? null, draft.id, persistedOrder);
    setReorderingImages(false);
    if (!result.ok) {
      selectedImagesRef.current = previous;
      setSelectedImages(previous);
      setSubmitMessage(result.error.message);
      return;
    }

    const refreshedById = new Map(result.data.map((image) => [image.id, image] as const));
    updateSelectedImagesFromRef((entries) =>
      entries.map((entry) =>
        entry.uploadedImage
          ? { ...entry, uploadedImage: refreshedById.get(entry.uploadedImage.id) ?? entry.uploadedImage }
          : entry,
      ),
    );
  }

  async function retrySelectedImage(id: string) {
`,
);

await replaceOnce(
  "src/routes/add-listing.tsx",
  `                          <div className="p-2">
                            <p className="truncate font-bold">{preview.file.name}</p>
`,
  `                          <div className="p-2">
                            <div className="mb-2 flex items-center gap-1">
                              <button
                                type="button"
                                disabled={index === 0 || submitting || reorderingImages || preview.state === "uploading"}
                                onClick={() => void moveSelectedImage(preview.id, -1)}
                                className="rawaj-icon-button h-8 w-8 disabled:opacity-35"
                                aria-label={text("تحريك الصورة للأمام", "Move photo earlier")}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={index === selectedImagePreviews.length - 1 || submitting || reorderingImages || preview.state === "uploading"}
                                onClick={() => void moveSelectedImage(preview.id, 1)}
                                className="rawaj-icon-button h-8 w-8 disabled:opacity-35"
                                aria-label={text("تحريك الصورة للخلف", "Move photo later")}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                              <span className="ms-auto text-[9px] font-semibold text-muted-foreground">
                                {text(\`الترتيب \${index + 1}\`, \`Order \${index + 1}\`)}
                              </span>
                            </div>
                            <p className="truncate font-bold">{preview.file.name}</p>
`,
);

await replaceOnce(
  "src/routes/profile/listings.$id.tsx",
  `import { Camera, RefreshCw, Trash2, X } from "lucide-react";
`,
  `import { ArrowDown, ArrowUp, Camera, RefreshCw, Trash2, X } from "lucide-react";
`,
);

await replaceOnce(
  "src/routes/profile/listings.$id.tsx",
  `  deleteOwnerListing,
  fetchListingImages,
`,
  `  deleteOwnerListing,
  fetchListingImages,
  isOwnerDeletableStatus,
  reorderListingImages,
`,
);

await replaceOnce(
  "src/routes/profile/listings.$id.tsx",
  `  const [uploadError, setUploadError] = useState<string | null>(null);
`,
  `  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reorderingImages, setReorderingImages] = useState(false);
`,
);

await replaceOnce(
  "src/routes/profile/listings.$id.tsx",
  `  const isDeletable = listing?.status === "draft" || listing?.status === "rejected";
`,
  `  const isDeletable = Boolean(listing && isOwnerDeletableStatus(listing.status));
`,
);

await replaceOnce(
  "src/routes/profile/listings.$id.tsx",
  `  function clearSelectedImages() {
`,
  `  function moveSelectedPendingImage(entryId: string, direction: -1 | 1) {
    if (uploading || reorderingImages) return;
    const current = selectedImagesRef.current;
    const index = current.findIndex((item) => item.id === entryId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return;
    const next = [...current];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    selectedImagesRef.current = next;
    setSelectedImages(next);
  }

  function clearSelectedImages() {
`,
);

await replaceOnce(
  "src/routes/profile/listings.$id.tsx",
  `  function handleDeleteImage(image: ListingImage) {
    void (async () => {
      setImagesLoading(true);
      const result = await deleteListingImage(auth.profile?.id ?? null, listing!.id, image);
      setImagesLoading(false);
      if (result.ok) {
        setImages((value) => value.filter((item) => item.id !== image.id));
      } else {
        setUploadError(result.error.message);
      }
    })();
  }
`,
  `  async function moveExistingImage(imageId: string, direction: -1 | 1) {
    if (!listing || !isEditable || imagesLoading || uploading || reorderingImages) return;
    const current = imagesRef.current;
    const index = current.findIndex((image) => image.id === imageId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return;

    const previous = [...current];
    const next = [...current];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    imagesRef.current = next;
    setImages(next);
    setReorderingImages(true);
    setUploadError(null);

    const result = await reorderListingImages(
      auth.profile?.id ?? null,
      listing.id,
      next.map((image, sortOrder) => ({ id: image.id, sortOrder })),
    );
    setReorderingImages(false);
    if (!result.ok) {
      imagesRef.current = previous;
      setImages(previous);
      setUploadError(result.error.message);
      return;
    }
    imagesRef.current = result.data;
    setImages(result.data);
  }

  function handleDeleteImage(image: ListingImage) {
    void (async () => {
      setImagesLoading(true);
      const result = await deleteListingImage(auth.profile?.id ?? null, listing!.id, image);
      setImagesLoading(false);
      if (result.ok) {
        const nextImages = imagesRef.current.filter((item) => item.id !== image.id);
        imagesRef.current = nextImages;
        setImages(nextImages);
      } else {
        setUploadError(result.error.message);
      }
    })();
  }
`,
);

await replaceOnce(
  "src/routes/profile/listings.$id.tsx",
  `                    {isEditable && (
                      <button
                        type="button"
                        disabled={imagesLoading || uploading}
`,
  `                    {isEditable && images.length > 1 && (
                      <div className="mt-1 grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          disabled={index === 0 || imagesLoading || uploading || reorderingImages}
                          onClick={() => void moveExistingImage(image.id, -1)}
                          className="rawaj-chip min-h-9 justify-center px-2 disabled:opacity-35"
                          aria-label={text("تحريك الصورة للأمام", "Move photo earlier")}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === images.length - 1 || imagesLoading || uploading || reorderingImages}
                          onClick={() => void moveExistingImage(image.id, 1)}
                          className="rawaj-chip min-h-9 justify-center px-2 disabled:opacity-35"
                          aria-label={text("تحريك الصورة للخلف", "Move photo later")}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {isEditable && (
                      <button
                        type="button"
                        disabled={imagesLoading || uploading || reorderingImages}
`,
);

await replaceOnce(
  "src/routes/profile/listings.$id.tsx",
  `                        <div className="p-2">
                          <p className="truncate font-bold">{preview.file.name}</p>
`,
  `                        <div className="p-2">
                          <div className="mb-2 flex gap-1">
                            <button
                              type="button"
                              disabled={index === 0 || uploading || preview.state === "uploading"}
                              onClick={() => moveSelectedPendingImage(preview.id, -1)}
                              className="rawaj-icon-button h-8 w-8 disabled:opacity-35"
                              aria-label={text("تحريك الصورة للأمام", "Move photo earlier")}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={index === selectedImages.length - 1 || uploading || preview.state === "uploading"}
                              onClick={() => moveSelectedPendingImage(preview.id, 1)}
                              className="rawaj-icon-button h-8 w-8 disabled:opacity-35"
                              aria-label={text("تحريك الصورة للخلف", "Move photo later")}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="truncate font-bold">{preview.file.name}</p>
`,
);

await writeFile(
  "scripts/launch-readiness-batch-1.test.mjs",
  `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [login, callback, addRoute, editRoute, api, barrel, packageJson] = await Promise.all([
  readFile(new URL("../src/routes/login.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/auth.callback.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/add-listing.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/profile/listings.$id.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-image-order.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("new accounts with an immediate Supabase session enter RAWAJ directly", () => {
  assert.match(login, /if \(result\.data\.session\)[\s\S]{0,280}navigate\(\{ to: returnTo \}\)/);
  assert.match(login, /result\.data\.session/);
});

test("authentication callback always releases its auth listener", () => {
  assert.match(callback, /let unsubscribeAuth: \(\(\) => void\) \| undefined/);
  assert.match(callback, /unsubscribeAuth = \(\) => listener\.subscription\.unsubscribe\(\)/);
  assert.match(callback, /unsubscribeAuth\?\.\(\)/);
});

test("owner deletion UI uses the shared API status contract", () => {
  assert.match(editRoute, /isOwnerDeletableStatus\(listing\.status\)/);
  assert.doesNotMatch(editRoute, /const isDeletable = listing\?\.status === "draft"/);
});

test("listing image ordering is persisted with ownership, state and zero-row checks", () => {
  assert.match(barrel, /listing-image-order/);
  assert.match(api, /export async function reorderListingImages/);
  assert.match(api, /\.eq\("owner_id", userId\)/);
  assert.match(api, /\.in\("status", \["draft", "rejected"\]\)/);
  assert.match(api, /current\.length !== normalized\.length/);
  assert.match(api, /if \(updateError \|\| !updated\)/);
  assert.match(api, /originalOrder/);
});

test("create and edit studios expose deterministic photo order controls", () => {
  assert.match(addRoute, /async function moveSelectedImage/);
  assert.match(addRoute, /reorderListingImages/);
  assert.match(editRoute, /async function moveExistingImage/);
  assert.match(editRoute, /function moveSelectedPendingImage/);
  assert.match(addRoute, /Move photo earlier/);
  assert.match(editRoute, /Move photo later/);
});

test("Batch 1 and auth recovery contracts are permanent Quality Gate inputs", () => {
  const parsed = JSON.parse(packageJson);
  assert.ok(parsed.scripts["test:auth-recovery"]);
  assert.ok(parsed.scripts["test:launch-readiness-batch-1"]);
  assert.match(parsed.scripts.check, /test:auth-recovery/);
  assert.match(parsed.scripts.check, /test:launch-readiness-batch-1/);
});
`,
);

await replaceOnce(
  "package.json",
  `&& npm run test:chat-workspace && npm run test:listing-studio-images && npm run test:activity-center`,
  `&& npm run test:chat-workspace && npm run test:auth-recovery && npm run test:listing-studio-images && npm run test:launch-readiness-batch-1 && npm run test:activity-center`,
);

await replaceOnce(
  "package.json",
  `    "test:listing-studio-images": "node --test scripts/listing-studio-image-parity.test.mjs",
`,
  `    "test:auth-recovery": "node --test scripts/auth-recovery.test.mjs",
    "test:listing-studio-images": "node --test scripts/listing-studio-image-parity.test.mjs",
    "test:launch-readiness-batch-1": "node --test scripts/launch-readiness-batch-1.test.mjs",
`,
);

console.log("Launch readiness Batch 1 patch applied.");
