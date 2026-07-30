export interface LocalListingImageState {
  state: "pending" | "uploading" | "uploaded" | "failed";
  uploadedImage?: { id: string; listingId: string } | null;
}

export interface AddListingDirtyStateInput {
  hasMeaningfulServerChanges: boolean;
  autosaveState: "idle" | "dirty" | "saving" | "saved" | "failed";
  draftId: string | null;
  draftStatus: string | null;
  submitting: boolean;
  images: readonly LocalListingImageState[];
}

export interface AddListingDirtyState {
  unsavedServerChanges: boolean;
  unsavedLocalImageChanges: boolean;
  shouldBlockNavigation: boolean;
}

export function hasUnsavedLocalListingImages(
  images: readonly LocalListingImageState[],
  draftId: string | null,
): boolean {
  return images.some(
    (image) =>
      image.state !== "uploaded" ||
      !image.uploadedImage?.id.trim() ||
      !draftId ||
      image.uploadedImage.listingId !== draftId,
  );
}

export function getAddListingDirtyState({
  hasMeaningfulServerChanges,
  autosaveState,
  draftId,
  draftStatus,
  submitting,
  images,
}: AddListingDirtyStateInput): AddListingDirtyState {
  const draftIsEditable = !draftStatus || draftStatus === "draft";
  const unsavedServerChanges =
    draftIsEditable && hasMeaningfulServerChanges && autosaveState !== "saved";
  const unsavedLocalImageChanges = draftIsEditable && hasUnsavedLocalListingImages(images, draftId);

  return {
    unsavedServerChanges,
    unsavedLocalImageChanges,
    shouldBlockNavigation: !submitting && (unsavedServerChanges || unsavedLocalImageChanges),
  };
}
