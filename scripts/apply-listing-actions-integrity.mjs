import { readFile, rm, writeFile } from "node:fs/promises";

async function transform(path, mutate) {
  const source = await readFile(path, "utf8");
  const next = mutate(source);
  if (next === source) throw new Error(`${path}: transformation made no changes`);
  await writeFile(path, next);
}

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

function replaceRegexOnce(source, pattern, replacement, label) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const count = [...source.matchAll(new RegExp(pattern.source, flags))].length;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(pattern, replacement);
}

await transform("src/routes/profile/listings.$id.tsx", (initial) => {
  let source = initial;
  source = replaceOnce(
    source,
    `  const uploadAllInFlightRef = useRef(false);\n  const initialSnapshotRef`,
    `  const uploadAllInFlightRef = useRef(false);\n  const imageReorderInFlightRef = useRef(false);\n  const imageDeleteInFlightRef = useRef<Set<string>>(new Set());\n  const initialSnapshotRef`,
    "edit listing image action locks",
  );
  source = replaceOnce(
    source,
    `      setSavingSuccess(\n        listing.status === "draft"\n          ? text(\n              "تم حفظ التعديلات. الإعلان ما زال مسودة.",\n              "Changes saved. The listing is still a draft.",\n            )\n          : text("تم حفظ التعديلات.", "Changes saved."),\n      );\n    } finally {`,
    `      setSavingSuccess(\n        listing.status === "draft"\n          ? text(\n              "تم حفظ التعديلات. الإعلان ما زال مسودة.",\n              "Changes saved. The listing is still a draft.",\n            )\n          : text("تم حفظ التعديلات.", "Changes saved."),\n      );\n    } catch (error) {\n      setSavingError(\n        error instanceof Error\n          ? error.message\n          : text("تعذر حفظ التعديلات. حاول مرة أخرى.", "Could not save changes. Try again."),\n      );\n    } finally {`,
    "edit listing save exception handling",
  );
  source = replaceOnce(
    source,
    `      setListing(submitResult.data);\n      setSavingSuccess(text("تم إعادة إرسال الإعلان للمراجعة.", "Listing resubmitted for review."));\n    } finally {`,
    `      setListing(submitResult.data);\n      setSavingSuccess(text("تم إعادة إرسال الإعلان للمراجعة.", "Listing resubmitted for review."));\n    } catch (error) {\n      setSavingError(\n        error instanceof Error\n          ? error.message\n          : text(\n              "تعذر إعادة إرسال الإعلان للمراجعة. حاول مرة أخرى.",\n              "Could not resubmit the listing for review. Try again.",\n            ),\n      );\n    } finally {`,
    "edit listing resubmit exception handling",
  );
  source = replaceRegexOnce(
    source,
    /  const handleDelete = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[listing, isDeletable, auth\.profile\?\.id, navigate, text\]\);/,
    `  const handleDelete = useCallback(async () => {
    if (!listing || !isDeletable || deleteInFlightRef.current) return;
    if (!confirm(text("حذف الإعلان نهائياً؟", "Delete this listing permanently?"))) return;

    deleteInFlightRef.current = true;
    setDeleting(true);
    setSavingError(null);
    try {
      const result = await deleteOwnerListing(auth.profile?.id ?? null, listing.id);
      if (!result.ok) {
        setSavingError(result.error.message);
        return;
      }
      await navigate({ to: "/profile" });
    } catch (error) {
      setSavingError(
        error instanceof Error
          ? error.message
          : text("تعذر حذف الإعلان. حاول مرة أخرى.", "Could not delete the listing. Try again."),
      );
    } finally {
      deleteInFlightRef.current = false;
      setDeleting(false);
    }
  }, [listing, isDeletable, auth.profile?.id, navigate, text]);`,
    "edit listing delete lifecycle",
  );
  source = replaceRegexOnce(
    source,
    /  async function handleUploadImages\(\) \{[\s\S]*?\n  \}\n\n  async function moveExistingImage/,
    `  async function handleUploadImages() {
    if (!listing || selectedImagesRef.current.length === 0 || uploadAllInFlightRef.current) return;
    uploadAllInFlightRef.current = true;
    setUploading(true);
    setUploadError(null);
    try {
      for (const entry of [...selectedImagesRef.current]) {
        await uploadSelectedImage(entry.id);
      }
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : text("تعذر رفع الصور. حاول مرة أخرى.", "Could not upload photos. Try again."),
      );
    } finally {
      uploadAllInFlightRef.current = false;
      setUploading(false);
    }
  }

  async function moveExistingImage`,
    "edit listing upload lifecycle",
  );
  source = replaceRegexOnce(
    source,
    /  async function moveExistingImage\(imageId: string, direction: -1 \| 1\) \{[\s\S]*?\n  \}\n\n  function handleDeleteImage/,
    `  async function moveExistingImage(imageId: string, direction: -1 | 1) {
    if (
      !listing ||
      !isEditable ||
      imagesLoading ||
      uploading ||
      imageReorderInFlightRef.current
    ) {
      return;
    }
    const current = imagesRef.current;
    const index = current.findIndex((image) => image.id === imageId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return;

    imageReorderInFlightRef.current = true;
    const previous = [...current];
    const next = [...current];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    imagesRef.current = next;
    setImages(next);
    setReorderingImages(true);
    setUploadError(null);

    try {
      const result = await reorderListingImages(
        auth.profile?.id ?? null,
        listing.id,
        next.map((image, sortOrder) => ({ id: image.id, sortOrder })),
      );
      if (!result.ok) {
        imagesRef.current = previous;
        setImages(previous);
        setUploadError(result.error.message);
        return;
      }
      imagesRef.current = result.data;
      setImages(result.data);
    } catch (error) {
      imagesRef.current = previous;
      setImages(previous);
      setUploadError(
        error instanceof Error
          ? error.message
          : text("تعذر ترتيب الصور. حاول مرة أخرى.", "Could not reorder photos. Try again."),
      );
    } finally {
      imageReorderInFlightRef.current = false;
      setReorderingImages(false);
    }
  }

  function handleDeleteImage`,
    "edit listing reorder lifecycle",
  );
  source = replaceRegexOnce(
    source,
    /  function handleDeleteImage\(image: ListingImage\) \{[\s\S]*?\n  \}\n\n  if \(loading\)/,
    `  function handleDeleteImage(image: ListingImage) {
    if (!listing || imageDeleteInFlightRef.current.size > 0) return;
    const currentListing = listing;
    imageDeleteInFlightRef.current.add(image.id);
    setImagesLoading(true);
    setUploadError(null);
    void (async () => {
      try {
        const result = await deleteListingImage(
          auth.profile?.id ?? null,
          currentListing.id,
          image,
        );
        if (!result.ok) {
          setUploadError(result.error.message);
          return;
        }
        const nextImages = imagesRef.current.filter((item) => item.id !== image.id);
        imagesRef.current = nextImages;
        setImages(nextImages);
      } catch (error) {
        setUploadError(
          error instanceof Error
            ? error.message
            : text("تعذر حذف الصورة. حاول مرة أخرى.", "Could not delete the photo. Try again."),
        );
      } finally {
        imageDeleteInFlightRef.current.delete(image.id);
        setImagesLoading(false);
      }
    })();
  }

  if (loading)`,
    "edit listing image delete lifecycle",
  );
  return source;
});

await transform("src/routes/add-listing.tsx", (initial) => {
  let source = initial;
  source = replaceOnce(
    source,
    `  const imageRemovalInFlightRef = useRef<Set<string>>(new Set());\n  const imageUploadOperationRef`,
    `  const imageRemovalInFlightRef = useRef<Set<string>>(new Set());\n  const imageReorderInFlightRef = useRef(false);\n  const imageUploadOperationRef`,
    "add listing image reorder lock",
  );
  source = replaceOnce(
    source,
    `      setDynamicSchema(result.data);\n      setDynamicValues(defaults);\n    });`,
    `      setDynamicSchema(result.data);\n      setDynamicValues(defaults);\n    }).catch((error: unknown) => {\n      if (requestId !== dynamicSchemaRequestIdRef.current) return;\n      setDynamicSchemaLoading(false);\n      setDynamicSchemaError(\n        error instanceof Error\n          ? error.message\n          : text(\n              "تعذر تحميل حقول التصنيف. حاول مرة أخرى.",\n              "Could not load category fields. Try again.",\n            ),\n      );\n    });`,
    "add listing dynamic schema exception handling",
  );
  source = replaceOnce(
    source,
    `  }, [selectedTaxonomyNode?.isLeaf, taxonomyNodeId]);`,
    `  }, [selectedTaxonomyNode?.isLeaf, taxonomyNodeId, text]);`,
    "add listing dynamic schema dependencies",
  );
  source = replaceRegexOnce(
    source,
    /  async function moveSelectedImage\(id: string, direction: -1 \| 1\) \{[\s\S]*?\n  \}\n\n  async function retrySelectedImage/,
    `  async function moveSelectedImage(id: string, direction: -1 | 1) {
    if (submittingRef.current || imageReorderInFlightRef.current) return;
    const current = selectedImagesRef.current;
    if (current.some((entry) => entry.state === "uploading")) return;
    const index = current.findIndex((entry) => entry.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return;

    imageReorderInFlightRef.current = true;
    const previous = [...current];
    const next = [...current];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    selectedImagesRef.current = next;
    setSelectedImages(next);

    const draft = draftListingRef.current;
    const persistedOrder = next.flatMap((entry, sortOrder) =>
      entry.uploadedImage ? [{ id: entry.uploadedImage.id, sortOrder }] : [],
    );
    if (!draft || persistedOrder.length === 0) {
      imageReorderInFlightRef.current = false;
      return;
    }

    setReorderingImages(true);
    setSubmitMessage(null);
    try {
      const result = await reorderListingImages(auth.profile?.id ?? null, draft.id, persistedOrder);
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
            ? {
                ...entry,
                uploadedImage: refreshedById.get(entry.uploadedImage.id) ?? entry.uploadedImage,
              }
            : entry,
        ),
      );
    } catch (error) {
      selectedImagesRef.current = previous;
      setSelectedImages(previous);
      setSubmitMessage(
        error instanceof Error
          ? error.message
          : text("تعذر ترتيب الصور. حاول مرة أخرى.", "Could not reorder photos. Try again."),
      );
    } finally {
      imageReorderInFlightRef.current = false;
      setReorderingImages(false);
    }
  }

  async function retrySelectedImage`,
    "add listing reorder lifecycle",
  );
  source = replaceRegexOnce(
    source,
    /  const loadSetup = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[\]\);/,
    `  const loadSetup = useCallback(async () => {
    const requestId = ++setupRequestIdRef.current;
    setLoading(true);
    setSetupError(null);
    try {
      const [categoriesResult, governoratesResult, taxonomyResult] = await Promise.all([
        fetchPublicCategories(),
        fetchPublicGovernorates(),
        fetchPublicTaxonomyNodes(),
      ]);
      if (requestId !== setupRequestIdRef.current) return;
      if (!categoriesResult.ok) {
        setSetupError(categoriesResult.error);
        return;
      }
      if (!governoratesResult.ok) {
        setSetupError(governoratesResult.error);
        return;
      }
      setCategories(categoriesResult.data);
      setGovernorates(governoratesResult.data);
      setTaxonomyNodes(taxonomyResult.ok ? taxonomyResult.data : []);
    } catch (error) {
      if (requestId !== setupRequestIdRef.current) return;
      setSetupError({
        code: "unknown",
        message:
          error instanceof Error
            ? error.message
            : text("تعذر تجهيز نموذج النشر. حاول مرة أخرى.", "Could not prepare the posting form. Try again."),
        operation: "add_listing_setup",
      });
    } finally {
      if (requestId === setupRequestIdRef.current) setLoading(false);
    }
  }, [text]);`,
    "add listing setup lifecycle",
  );
  source = replaceOnce(
    source,
    `      setSubmitMessage(\n        imageErrors.length > 0\n          ? text(\n              \`تم إرسال الإعلان للمراجعة، وتعذر رفع بعض الصور: \${imageErrors[0]}\`,\n              \`Listing was sent for review, and some photos could not upload: \${imageErrors[0]}\`,\n            )\n          : text(\n              "تم إرسال الإعلان للمراجعة. سيظهر للعامة بعد الموافقة.",\n              "Listing sent for review. It will be public after approval.",\n            ),\n      );\n    } finally {`,
    `      setSubmitMessage(\n        imageErrors.length > 0\n          ? text(\n              \`تم إرسال الإعلان للمراجعة، وتعذر رفع بعض الصور: \${imageErrors[0]}\`,\n              \`Listing was sent for review, and some photos could not upload: \${imageErrors[0]}\`,\n            )\n          : text(\n              "تم إرسال الإعلان للمراجعة. سيظهر للعامة بعد الموافقة.",\n              "Listing sent for review. It will be public after approval.",\n            ),\n      );\n    } catch (error) {\n      setSubmitMessage(\n        error instanceof Error\n          ? error.message\n          : text(\n              "تعذر إرسال الإعلان. تم الاحتفاظ بالمسودة لتعيد المحاولة.",\n              "Could not submit the listing. The draft was kept so you can retry.",\n            ),\n      );\n    } finally {`,
    "add listing submit exception handling",
  );
  return source;
});

await rm("scripts/apply-listing-actions-integrity.mjs", { force: true });
