# Syria non-Supabase release gate

## Scope

This gate advances RAWAJ Syria release readiness without changing or configuring Supabase.
It is limited to public web deployment truth, security headers, canonical public documents,
Digital Asset Links failure safety, and repository/Android release validation.

## Hard boundaries

- No Supabase schema, data, Auth, Storage, Edge Function, project, or dashboard change.
- No Vercel Production promotion.
- No custom-domain reassignment.
- No Google Play upload or track promotion.
- No authenticated account mutation.
- No public listing, message, notification, or support-request mutation.

## Current deployment truth

Observed on 2026-07-21:

- Reviewed `main` release candidate: `bb7c0f17ba9a640740021bc68bd3b81ede65266e`.
- Vercel produced a ready deployment for that commit.
- The public domain `https://rawa-j.com` still exposes build commit
  `868b98dcd67ff876020e214ea564b47e4d3c087a`.
- Therefore public Production acceptance remains **NO-GO** until the reviewed commit is
  deliberately promoted/assigned and the public audit passes against the exact deployed SHA.

A Vercel deployment marked `production` is not sufficient proof by itself. The custom domain
must expose the same expected commit through `x-rawaj-build-commit` or the equivalent HTML
build metadata.

## Permanent audit

Run the manual GitHub Actions workflow **Public Release Candidate Audit** with:

- `base_url`: the exact HTTPS origin being reviewed;
- `expected_commit`: the full expected Git commit SHA;
- `require_configured_app_links`: `false` until the real Play App Signing fingerprint is
  configured, then `true` for final Android App Links acceptance.

The audit performs GET-only checks against:

- home, categories, listings, offers;
- login and password-reset surfaces;
- support, safety, prohibited listings, privacy, and terms;
- robots.txt and sitemap.xml;
- Digital Asset Links.

It rejects:

- unexpected redirects;
- non-200 public routes;
- missing or mismatched build commit metadata;
- missing core security headers;
- cacheable login/reset-password responses;
- invalid public document content types;
- malformed App Links identity;
- any host outside `rawa-j.com`, `www.rawa-j.com`, and Vercel deployment hosts.

## Android status boundary

Repository-owned Android Release Candidate compilation may pass before final Android sign-off.
The Android stage remains externally incomplete until the Play App Signing SHA-256 is known,
Digital Asset Links returns HTTP 200 with that fingerprint, and the Play-signed build passes
physical-device deep-link and upgrade acceptance.

## Promotion rule

Do not promote or reassign the public domain merely to make this audit green. First select the
reviewed release candidate, complete diff review and repository checks, then perform the manual
promotion. Run this audit immediately afterward using the exact promoted commit.
