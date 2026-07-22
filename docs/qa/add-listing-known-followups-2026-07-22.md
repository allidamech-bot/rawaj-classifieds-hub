# Add listing known follow-ups

This recovery PR intentionally fixes confirmed blocking interaction and presentation regressions first.

Next inspection sequence after this PR validates successfully:

1. Category leaf selection and validation feedback.
2. Forward/backward step persistence with real entered values.
3. Image selection, upload, removal, ordering, retry, and stale cleanup.
4. Price type, canonical location, and optional contact methods.
5. Autosave races and draft restoration.
6. Final review submission and account listing visibility.

No item in this list is considered closed until it has a reproducible interaction check.
