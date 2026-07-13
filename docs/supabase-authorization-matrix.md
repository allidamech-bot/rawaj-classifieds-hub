# Supabase authorization matrix

RAWAJ's behavioral authorization harness runs only with the public Supabase URL and anon key. It never uses a service-role key and never applies migrations.

## Protected GitHub environment

Create the protected environment `authorization-matrix-staging` and add these secrets:

- `SUPABASE_URL`: staging project URL.
- `SUPABASE_ANON_KEY`: staging public anon key.
- `RAWAJ_AUTH_MATRIX_ACCOUNTS`: JSON object containing dedicated `owner`, `other`, and `staff` accounts, plus an optional suspended or blocked account. Each entry has only `email` and `password` fields.
- `RAWAJ_AUTH_MATRIX_FIXTURES`: JSON fixture manifest described below.

Do not use employee, owner-production, or customer accounts. The workflow masks the JSON secrets and does not print them.

## Fixture manifest

Provision dedicated staging rows whose ownership matches the accounts above, then store only their identifiers:

```json
{
  "environment": "staging",
  "publicListingId": "uuid",
  "privateListingId": "uuid owned by owner",
  "ownerNotificationId": "uuid",
  "ownerSupportRequestId": "uuid",
  "ownerConversationId": "uuid",
  "ownerMessageId": "uuid",
  "ownerSavedSearchId": "uuid",
  "ownerListingReportId": "uuid",
  "ownerMessageReportId": "uuid",
  "ownerUserBlockId": "uuid",
  "ownerPendingSellerReviewId": "uuid",
  "categoryId": "active staging category uuid",
  "governorateId": "active staging governorate uuid",
  "staffCanManageUsers": false
}
```

The owner account must also have a `notification_preferences` row. The private listing and pending seller review must not be publicly readable. Set `staffCanManageUsers` to `true` only when the dedicated staff account is an admin or owner with the user-management permission.

## Modes

- `read-only` verifies anonymous, owner, other-user, staff, and optional blocked-user reads and admin RPC denial boundaries.
- `staging-mutation` additionally creates one marked disposable draft, verifies horizontal update and `owner_id` tamper denial, uploads a private image, submits and moderates the draft, and removes the listing and image in `finally` cleanup.

Mutation mode refuses any fixture manifest whose `environment` is not exactly `staging`. Production remains a manual external gate: review and apply any required SQL in the Supabase Dashboard before running the read-only matrix there with dedicated acceptance accounts.
