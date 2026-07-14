from pathlib import Path

path = Path('src/routes/add-listing.tsx')
source = path.read_text()

import_line = 'import { runBoundedTasks } from "@/lib/bounded-task-queue";\n'
if import_line not in source:
    marker = 'import {\n  checkListingContentSafety,\n  isSafePhoneValue,\n  normalizeContactValue,\n} from "@/lib/content-safety";\n'
    if marker not in source:
        raise SystemExit('content safety import marker not found')
    source = source.replace(marker, marker + import_line, 1)

if 'const IMAGE_UPLOAD_CONCURRENCY = 2;' not in source:
    marker = 'const MAX_IMAGES = 6;\n'
    if marker not in source:
        raise SystemExit('MAX_IMAGES marker not found')
    source = source.replace(marker, marker + 'const IMAGE_UPLOAD_CONCURRENCY = 2;\n', 1)

old = '''      const imageErrors: string[] = [];
      const cleanupErrors: string[] = [];
      const submitUploadAttemptedImageIds = new Set<string>();

      while (true) {
        await waitForAllImageUploadsInFlight();

        const currentEntry = selectedImagesRef.current.find(
          (entry) => entry.state !== "uploaded" && !submitUploadAttemptedImageIds.has(entry.id),
        );
        if (!currentEntry) break;

        submitUploadAttemptedImageIds.add(currentEntry.id);
        const operation = beginImageUploadOperation(currentEntry.id);

        const latestBeforeUpload = selectedImagesRef.current.find(
          (entry) => entry.id === currentEntry.id,
        );
        if (!latestBeforeUpload) {
          clearImageUploadOperation(currentEntry.id, operation);
          continue;
        }

        const uploadResult = await uploadListingImage({
          userId: auth.profile?.id ?? null,
          listing: listingDraft,
          file: latestBeforeUpload.file,
          sortOrder: selectedImagesRef.current.findIndex((entry) => entry.id === currentEntry.id),
          altAr: title.trim(),
        });

        const latestAfterUpload = selectedImagesRef.current.find(
          (entry) => entry.id === currentEntry.id,
        );
        const isCurrentOperation =
          Boolean(latestAfterUpload) && isCurrentImageUploadOperation(currentEntry.id, operation);

        if (!isCurrentOperation) {
          if (uploadResult.ok) {
            const cleanupFailure = await registerStaleUploadCleanup({
              draftId: listingDraft.id,
              imageId: currentEntry.id,
              userId: auth.profile?.id ?? null,
              uploadedImage: uploadResult.data,
            });
            if (cleanupFailure) {
              cleanupErrors.push(cleanupFailure);
            }
          }
          clearImageUploadOperation(currentEntry.id, operation);
          continue;
        }

        if (!uploadResult.ok) {
          imageErrors.push(uploadResult.error.message);
        }

        updateSelectedImagesFromRef((current) => {
          const currentImage = current.find((item) => item.id === currentEntry.id);
          if (!currentImage || currentImage.attempt !== operation) {
            return current;
          }

          if (!uploadResult.ok) {
            return current.map((item) =>
              item.id === currentEntry.id
                ? {
                    ...item,
                    state: "failed" as const,
                    error: uploadResult.error.message,
                  }
                : item,
            );
          }

          return current.map((item) =>
            item.id === currentEntry.id
              ? {
                  ...item,
                  state: "uploaded" as const,
                  uploadedImage: uploadResult.data,
                }
              : item,
          );
        });

        clearImageUploadOperation(currentEntry.id, operation);
      }

      await waitForAllImageUploadsInFlight();
'''

new = '''      const imageErrors: string[] = [];
      const cleanupErrors: string[] = [];

      await waitForAllImageUploadsInFlight();
      const submitUploadEntries = selectedImagesRef.current.filter(
        (entry) => entry.state !== "uploaded",
      );

      await runBoundedTasks(
        submitUploadEntries,
        IMAGE_UPLOAD_CONCURRENCY,
        async (queuedEntry) => {
          const currentEntry = selectedImagesRef.current.find(
            (entry) => entry.id === queuedEntry.id,
          );
          if (!currentEntry || currentEntry.state === "uploaded") return;

          const operation = beginImageUploadOperation(currentEntry.id);
          try {
            const latestBeforeUpload = selectedImagesRef.current.find(
              (entry) => entry.id === currentEntry.id,
            );
            if (!latestBeforeUpload) return;

            const uploadResult = await uploadListingImage({
              userId: auth.profile?.id ?? null,
              listing: listingDraft,
              file: latestBeforeUpload.file,
              sortOrder: selectedImagesRef.current.findIndex(
                (entry) => entry.id === currentEntry.id,
              ),
              altAr: title.trim(),
            });

            const latestAfterUpload = selectedImagesRef.current.find(
              (entry) => entry.id === currentEntry.id,
            );
            const isCurrentOperation =
              Boolean(latestAfterUpload) &&
              isCurrentImageUploadOperation(currentEntry.id, operation);

            if (!isCurrentOperation) {
              if (uploadResult.ok) {
                const cleanupFailure = await registerStaleUploadCleanup({
                  draftId: listingDraft.id,
                  imageId: currentEntry.id,
                  userId: auth.profile?.id ?? null,
                  uploadedImage: uploadResult.data,
                });
                if (cleanupFailure) cleanupErrors.push(cleanupFailure);
              }
              return;
            }

            if (!uploadResult.ok) imageErrors.push(uploadResult.error.message);

            updateSelectedImagesFromRef((current) => {
              const currentImage = current.find((item) => item.id === currentEntry.id);
              if (!currentImage || currentImage.attempt !== operation) return current;

              if (!uploadResult.ok) {
                return current.map((item) =>
                  item.id === currentEntry.id
                    ? {
                        ...item,
                        state: "failed" as const,
                        error: uploadResult.error.message,
                      }
                    : item,
                );
              }

              return current.map((item) =>
                item.id === currentEntry.id
                  ? {
                      ...item,
                      state: "uploaded" as const,
                      uploadedImage: uploadResult.data,
                    }
                  : item,
              );
            });
          } catch (error: unknown) {
            const failure = error instanceof Error ? error.message : uploadFallbackMessage();
            imageErrors.push(failure);
            if (isCurrentImageUploadOperation(currentEntry.id, operation)) {
              updateSelectedImagesFromRef((current) =>
                current.map((item) =>
                  item.id === currentEntry.id
                    ? { ...item, state: "failed" as const, error: failure }
                    : item,
                ),
              );
            }
          } finally {
            clearImageUploadOperation(currentEntry.id, operation);
          }
        },
      );

      await waitForAllImageUploadsInFlight();
'''

if old in source:
    source = source.replace(old, new, 1)
elif 'const submitUploadEntries = selectedImagesRef.current.filter(' not in source:
    raise SystemExit('serial image upload block not found')

path.write_text(source)

package_path = Path('package.json')
package_source = package_path.read_text()
old_script = '"test:listing-image-content-reliability": "node --test scripts/listing-image-content-reliability.test.mjs"'
new_script = '"test:listing-image-content-reliability": "node --test scripts/listing-image-content-reliability.test.mjs scripts/listing-image-upload-concurrency.test.mjs"'
if old_script in package_source:
    package_source = package_source.replace(old_script, new_script, 1)
elif new_script not in package_source:
    raise SystemExit('image reliability script not found')
package_path.write_text(package_source)
