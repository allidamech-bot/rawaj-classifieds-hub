# RAWAJ production Auth and Android App Links handoff

This document defines the exact external values required to complete the production linking gate. Repository automation must not claim this gate is complete until the dashboard and physical-device evidence below are attached.

## Canonical identifiers

| Item | Required value |
| --- | --- |
| Production origin | `https://rawa-j.com` |
| Supabase Auth callback path | `/auth/callback` |
| Android package / application ID | `com.rawaj.marketplace` |
| Android App Links host | `rawa-j.com` |
| Digital Asset Links endpoint | `https://rawa-j.com/.well-known/assetlinks.json` |

## Supabase Auth dashboard

In **Authentication → URL Configuration**:

1. Set **Site URL** to `https://rawa-j.com`.
2. Add the exact production redirect URL `https://rawa-j.com/auth/callback`.
3. Add preview or localhost wildcard URLs only for their own non-production environments. Do not replace the exact production callback with a broad production wildcard.
4. Confirm password-recovery and confirmation email templates use the redirect destination supplied by the application where required.

In **Authentication → Providers → Google**:

1. Confirm Google is enabled only with the intended production OAuth client.
2. Confirm the provider callback shown by Supabase is registered in Google Cloud.
3. Run a real production Google sign-in and verify return to `/auth/callback`.

## Android App Links deployment

1. In Play Console, open **App integrity / App signing** and copy the SHA-256 fingerprint of the **App signing key certificate**.
2. Set the server-only Production environment variable:

   `RAWAJ_ANDROID_SHA256_CERT_FINGERPRINTS=<PLAY_APP_SIGNING_SHA256>`

   Multiple current fingerprints may be separated by commas or new lines during a controlled key transition. Production must never use a debug certificate or the upload-key certificate in this value.
3. Deploy the exact reviewed commit.
4. Verify the endpoint:

   - returns HTTP `200`;
   - does not redirect;
   - uses `Content-Type: application/json`;
   - contains package `com.rawaj.marketplace`;
   - contains the Play App Signing SHA-256 fingerprint, not a debug or upload-key fingerprint.
5. On a physical Android device with the Play-signed build, reset and re-run App Links verification, then confirm `https://rawa-j.com/...` opens directly in RAWAJ.

## Failure-safe behavior

Until a valid release fingerprint is configured, `/.well-known/assetlinks.json` intentionally returns HTTP `503`. This prevents a placeholder or debug fingerprint from being mistaken for completed production verification.

## External evidence required before launch sign-off

- Screenshot/export of Supabase Site URL and Redirect URLs.
- Screenshot of enabled Google provider and the matching Google OAuth configuration.
- HTTP evidence for the deployed `assetlinks.json` endpoint.
- Play Console App signing SHA-256 evidence.
- Physical-device App Links verification result.
- Real password-recovery and Google OAuth return tests on Production.
