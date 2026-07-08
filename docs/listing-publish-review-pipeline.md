# RAWAJ Listing Publish & Review Pipeline

This hotfix makes the customer listing journey one coherent operational path:

1. Customer creates or autosaves a `draft` listing.
2. Canonical Syria location selection is accepted even when legacy governorate UI state is empty; the effective governorate is resolved at the API boundary.
3. Images are uploaded while the listing is `draft` or `rejected`.
4. Submit/resubmit moves only an owned `draft` or `rejected` listing to `pending_review`.
5. The pending queue is available to active Owner, Admin, and Moderator review staff.
6. Approve/reject decisions are stale-safe and require an expected `updated_at` version.
7. Approval sets `status = approved`, clears archival state, records reviewer/time, and sets `published_at`.
8. Rejection records the rejection reason and remains editable/resubmittable by the owner.
9. Public readers explicitly require `approved` and `archived_at is null`.
10. Approved listing images become readable through the existing approved/non-archived image metadata and private-storage policies.

## Fixed failures

- Owner/admin permissions could become all-false because a legacy staff profile remained `pending_review`.
- Existing provisioned Admin/Moderator profiles could have roles but still be operationally inactive.
- The add-listing form accepted a canonical location visually but autosave still required legacy governorate state.
- Rejected listing editing attempted to clear moderation fields and could be blocked by moderation-field protection.
- Rejected listing resubmit used a conflicting direct update path.
- `/admin/pending` used a fragile direct table query instead of one protected review queue contract.
- Pending approve/reject used a second direct mutation path instead of one stale-safe audited decision contract.
- Optional notification delivery could roll back an otherwise valid approval/rejection.
- Signed-in public readers could rely on broader RLS unions unless non-archived visibility was explicit in the query.

## Schema drift compatibility

Production availability remains protected when a newly introduced RPC is absent:

- submit falls back to the legacy owner resubmit path;
- pending queue falls back to the existing direct pending query;
- approve/reject falls back to the existing protected direct update with stale timestamp matching.

These fallbacks trigger only for mapped `schema_missing` errors. Other permission, network, validation, or database errors remain visible.

## Authority

- Owner, Admin, Moderator may review listings only when their persisted role and staff state authorize it.
- Owner authority remains special and is not zeroed by a stale legacy profile status in the frontend permission matrix.
- Frozen/disabled staff are not reactivated by role provisioning.
- Owner assignment of Admin/Moderator activates only legacy `pending_review` profiles.
