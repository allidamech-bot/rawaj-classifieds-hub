# RAWAJ rendered layout gate — 2026-07-29

## Scope

This gate belongs to Draft PR #524 on `feature/lovable-design-firebase`. It does not approve a merge or a Production deployment.

## Added enforcement

- Public rendered audit inventory expanded to 24 representative routes.
- Viewports: 360×800, 390×844, 412×915, and 1440×1000.
- Every rendered route must expose a visible `main` surface.
- Horizontal document overflow fails the audit.
- Root language and direction must be explicit (`ar`/`en`, `rtl`/`ltr`).
- Visible links and buttons require accessible names.
- Visible form controls require labels.
- Mobile buttons below the minimum audited height fail the audit.
- Authenticated acceptance now applies the same layout checks after sign-in.
- Screenshots remain evidence, not the acceptance criterion by themselves.

## Current validation

For commit `3edaa3b0be2d19641bc5621d5c0a5ac7f2fa313a`:

- Runtime Boundary Audit: passed.
- Cloudflare Cutover Foundation, including application typecheck and build: passed.
- Vercel did not begin the first Preview build because it could not fetch required Git information. This was a Vercel/Git handoff failure, not an application build failure. This documentation commit intentionally retriggers a clean Preview build.

## Remaining acceptance boundary

Production remains unchanged. Final authenticated rendered acceptance and any Production promotion require explicit approval after the Preview is reviewed.
