# RAWAJ Owner-Only System Controls

Sensitive system controls are owner-only and versioned.

## Controls

- freeze new listings
- freeze new messages
- freeze promotions
- freeze verifications
- maintenance mode
- emergency read-only

Every state change requires a clear reason, rejects stale versions, and writes an audit event. The recorded actor, control key, target state, reason, and resulting version remain reviewable through the audit workflow.

The UI is not treated as the enforcement boundary. Backend and RPC paths must read the relevant control before claiming that a freeze is active. The console therefore distinguishes persisted switch state from actual service-path enforcement.

Owner authority remains distinct from Admin and Moderator authority. Admins and Moderators cannot read or change these switches through the owner RPCs.
