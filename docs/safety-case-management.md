# RAWAJ Safety Case Management

Safety cases are explicit operational records. The system never marks a report resolved or a user risky by inference.

## Lifecycle

Cases support Open, Investigating, Mitigated, and Closed states. Status changes require a reason. Closing additionally requires a resolution note. Updates are version-checked to reject stale browser state.

## Sources and links

A case can originate from a manual review, listing report, message report, or account concern. Additional listing reports, message reports, listings, and accounts can be linked to the same case.

## Assignment and escalation

Cases can be assigned only to active Owner, Admin, or Moderator staff. Authorized safety operators can explicitly escalate a case to the Owner; escalation is audited and does not imply resolution.

## Internal notes

Staff-only notes are append-only operational evidence. Note creation and case links are audited. Direct table access is not used as the authorization boundary; RPCs re-check staff authority.

## Permissions

The UI requires the effective `canManageReports` permission. Database functions independently require authorized staff access. Owner authority remains distinct from Admin and Moderator authority.
