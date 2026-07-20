import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [addListing, manageListing] = await Promise.all([
  readFile(new URL("../src/routes/add-listing.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/profile/listings.$id.tsx", import.meta.url), "utf8"),
]);

test("new-listing setup and taxonomy loading release loading after exceptions", () => {
  assert.match(addListing, /const loadSetup = useCallback\(async \(\) => \{[\s\S]*?try \{/);
  assert.match(addListing, /operation: "add_listing_setup"/);
  assert.match(addListing, /finally \{[\s\S]*?setLoading\(false\)/);
  assert.match(addListing, /fetchPublishedLeafSchema[\s\S]*?\.catch\(\(error: unknown\) => \{/);
  assert.match(addListing, /setDynamicSchemaLoading\(false\);/);
});

test("new-listing image reorder is synchronous single-flight and rolls back", () => {
  assert.match(addListing, /const imageReorderInFlightRef = useRef\(false\);/);
  assert.match(addListing, /if \(submittingRef\.current \|\| imageReorderInFlightRef\.current\) return;/);
  assert.match(addListing, /imageReorderInFlightRef\.current = true;/);
  assert.match(addListing, /catch \(error\)[\s\S]*?selectedImagesRef\.current = previous/);
  assert.match(
    addListing,
    /finally \{[\s\S]*?imageReorderInFlightRef\.current = false;[\s\S]*?setReorderingImages\(false\);/,
  );
});

test("new-listing submission reports thrown failures and always unlocks", () => {
  assert.match(addListing, /async function submitListing\(\)[\s\S]*?if \(submittingRef\.current\) return;/);
  assert.match(addListing, /catch \(error\)[\s\S]*?تم الاحتفاظ بالمسودة/);
  assert.match(
    addListing,
    /finally \{[\s\S]*?removeEventListener\("beforeunload"[\s\S]*?setSubmitting\(false\);[\s\S]*?submittingRef\.current = false;/,
  );
});

test("listing save and resubmit expose unexpected errors and always unlock", () => {
  assert.match(manageListing, /const saveInFlightRef = useRef\(false\);/);
  assert.match(manageListing, /const resubmitInFlightRef = useRef\(false\);/);
  assert.match(manageListing, /const handleSave[\s\S]*?catch \(error\)[\s\S]*?setSavingError/);
  assert.match(manageListing, /const handleResubmit[\s\S]*?catch \(error\)[\s\S]*?setSavingError/);
  assert.match(
    manageListing,
    /const handleSave[\s\S]*?finally \{[\s\S]*?setSaving\(false\);[\s\S]*?saveInFlightRef\.current = false;/,
  );
  assert.match(
    manageListing,
    /const handleResubmit[\s\S]*?finally \{[\s\S]*?setResubmitting\(false\);[\s\S]*?resubmitInFlightRef\.current = false;/,
  );
});

test("listing delete and bulk upload cannot remain stuck", () => {
  assert.match(manageListing, /const handleDelete[\s\S]*?try \{/);
  assert.match(manageListing, /await navigate\(\{ to: "\/profile" \}\);/);
  assert.match(
    manageListing,
    /const handleDelete[\s\S]*?finally \{[\s\S]*?deleteInFlightRef\.current = false;[\s\S]*?setDeleting\(false\);/,
  );
  assert.match(manageListing, /async function handleUploadImages[\s\S]*?try \{/);
  assert.match(
    manageListing,
    /async function handleUploadImages[\s\S]*?finally \{[\s\S]*?uploadAllInFlightRef\.current = false;[\s\S]*?setUploading\(false\);/,
  );
});

test("existing image reorder and deletion are serialized and recover UI state", () => {
  assert.match(manageListing, /const imageReorderInFlightRef = useRef\(false\);/);
  assert.match(manageListing, /const imageDeleteInFlightRef = useRef<Set<string>>\(new Set\(\)\);/);
  assert.match(manageListing, /imageReorderInFlightRef\.current/);
  assert.match(manageListing, /catch \(error\)[\s\S]*?imagesRef\.current = previous/);
  assert.match(
    manageListing,
    /finally \{[\s\S]*?imageReorderInFlightRef\.current = false;[\s\S]*?setReorderingImages\(false\);/,
  );
  assert.match(manageListing, /if \(!listing \|\| imageDeleteInFlightRef\.current\.size > 0\) return;/);
  assert.match(
    manageListing,
    /function handleDeleteImage[\s\S]*?finally \{[\s\S]*?imageDeleteInFlightRef\.current\.delete\(image\.id\);[\s\S]*?setImagesLoading\(false\);/,
  );
});
