# RAWAJ Ad Placements

Ad placement management is owner-only.

Placement pages: home, search results, listing detail, categories, and offers.

Each placement stores a banner/image URL, destination URL, optional start/end schedule, draft/active/paused status, priority, mobile/desktop targeting, and a monotonic version used for stale-write protection.

Create, edit, activate, and pause operations are audited. Updates require the version loaded by the owner console, preventing stale browser state from silently overwriting newer changes.

The management UI does not display fake impressions, clicks, CTR, or other unmeasured analytics. Public rendering uses a dedicated RPC that returns only currently active, in-schedule placements matching the requested page and device class.
