# One-shot Cloudflare Worker release

This temporary release control deploys the reviewed Worker source at `ee933ba68cfde9e621ca6b1e5b0f3f0ea3b85f3e` only.

It is intentionally constrained to:

- verify that all later `main` changes are limited to release-control files;
- deploy the existing Worker with the repository's configured production bindings;
- run read-only production smoke tests;
- avoid D1 migrations;
- avoid Vercel deployment or promotion.

Delete this file and the matching workflow after the deployment result is recorded.
