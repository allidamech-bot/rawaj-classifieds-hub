# Structured offers production release

Reviewed application baseline: `d268b4753781cbb38a11747fc02d3162896fc52e`.

This one-shot release enables one Vercel Production deployment, applies pending D1 migrations including `0019_structured_listing_price_offers.sql`, deploys the matching Cloudflare Worker release, and runs authenticated Production Acceptance.

After successful acceptance, the one-shot workflow and this release note are removed and Vercel Git deployment is locked again.
