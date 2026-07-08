# RAWAJ Campaign Manager

Campaign management is owner-only and uses explicit `canManageAdCampaigns` UI authorization plus owner checks inside database RPCs.

## Lifecycle

Campaigns support Draft, Active, Paused, and Ended states with optional start/end scheduling. Status changes require a reason and are written to the audit log. Updates use monotonic versions so stale browser state cannot silently overwrite newer changes.

Immediate pause and end actions are server-authorized and audited; hiding a control in the interface is never treated as the security boundary.

## Targeting

A campaign may target one or more supported marketplace pages and optional category identifiers. Empty target arrays mean broad eligibility within the active schedule.

## Creatives

Each campaign may contain multiple creatives. A creative stores an image URL, destination URL, weight, active state, and version for stale-write protection.

## Metrics

Impressions, clicks, and CTR are derived only from rows recorded in `ad_campaign_events`. The owner console does not fabricate metrics. The event RPC validates the campaign, creative, schedule, page, and active state before accepting an event.

## Public selection

Public creative selection returns only creatives from active, in-schedule campaigns that match the requested page and optional category context.

The `/admin/campaigns` route is part of the generated TanStack route tree and is shown in admin navigation only when the effective permission matrix grants campaign management.
