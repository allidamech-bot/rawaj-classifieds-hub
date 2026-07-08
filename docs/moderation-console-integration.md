# RAWAJ Moderation Console Integration

Listing moderation has two explicit surfaces under one permission boundary:

- `/admin/pending` is the detailed pending-review queue, including full listing details and media inspection.
- `/admin/listings` is the lifecycle decision console for approve, request changes, reject, suspend, unpublish, archive, expire, and extend-expiry actions.

Both routes require the persisted `canModerateListings` permission, including direct URL access. Action clients receive the same effective permission rather than broad `canAccessAdmin` state.

The lifecycle console exposes live counts from its loaded moderation dataset and permission-aware links to listing and message report queues. Stale-write protection and required decision reasons remain authoritative for mutations.
