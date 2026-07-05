# RAWAJ authorization model

This document records the latest repository-level authorization intent. It does
not claim that every listed policy is already present in every live environment.

## Role hierarchy

The canonical role enum is expected to include:

- owner
- admin
- moderator
- user

Active account status is required by the repository helper functions below.

## Helper semantics

### `current_user_is_admin_like()`

Returns true for an active user with role `owner` or `admin`.

### `current_user_can_moderate()`

Returns true for an active user with role `owner`, `admin`, or `moderator`.

### `current_user_can_manage_roles()`

Returns true only for an active user with role `owner`.

The function name reflects role-management authority, but later repository
policies also use it as the owner-only platform-management gate for categories,
subcategories, governorates, taxonomy nodes, and hard-delete operations. That is
an intentional owner-only privilege boundary in the latest migration ordering,
although the helper name is broader than those individual domains.

## Canonical intent by capability

| Capability | owner | admin | moderator | user |
| --- | --- | --- | --- | --- |
| Manage roles | yes | no | no | no |
| Moderate listings/reports | yes | yes | yes | no |
| Read all moderation surfaces | yes | yes | yes | no |
| Hard-delete listings | yes | no | no | no |
| Hard-delete listing image metadata/objects | yes | no | no | no |
| Manage platform taxonomy/location catalogs | yes | no | no | no |
| Manage own pre-approval listing images | own only | own only | own only | own only |

## Listing image storage model

- Bucket: `listing-images`
- Bucket visibility: private
- Object path: `{user_id}/{listing_id}/{filename}`
- Public object access: approved, non-archived listing objects only
- Owner access: scoped to the authenticated owner's own listing paths
- Moderation read: follows the latest privileged moderation policies
- Hard delete: owner-only in the latest policy alignment intent

## Migration intent

- `202607010001_notifications_profile_roles_contract.sql` defines the active
  role helper semantics.
- `202607020003_owner_admin_moderator_policy_alignment.sql` applies the latest
  repository intent: owner-only hard delete and platform management, while
  owner/admin/moderator roles share moderation capability.
- `202607050001_reconcile_listing_image_storage_visibility.sql` removes legacy
  bucket-wide public object read without redefining role semantics.

Live environments must be inspected before replaying policy migrations. See
`docs/database-migration-status.md`.
