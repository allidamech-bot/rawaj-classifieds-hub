# RAWAJ Android 1.0.3 release gates

This branch prepares `com.rawaj.marketplace` version code `4` / version name `1.0.3`. It must not be merged or uploaded to Google Play until every gate below is complete.

## One-time service configuration

### Supabase Auth redirect allowlist

Add this exact redirect URL in Supabase Authentication URL Configuration:

```text
com.rawaj.marketplace://auth/callback
```

Keep the existing web callback as well:

```text
https://rawa-j.com/auth/callback
```

The Android OAuth flow uses PKCE. Chrome only performs the Google sign-in; the authorization code returns through the custom scheme and is exchanged inside the app WebView, where the PKCE verifier and persisted Supabase session live.

### Android App Links verification

Publish `https://rawa-j.com/.well-known/assetlinks.json` with:

- package name: `com.rawaj.marketplace`
- the SHA-256 certificate fingerprint shown under Google Play Console → App integrity → App signing key certificate
- relation: `delegate_permission/common.handle_all_urls`

Do not guess or use the upload-key fingerprint when Play App Signing is enabled. Validate after publishing with Android's domain verification tools or the App Links Assistant.

## Automated gates

Both pull-request workflows must be green:

- `Quality Gate`
- `Android Release Readiness`

The Android workflow must complete:

- Android readiness contract
- TypeScript typecheck
- production web build
- `npx cap sync android`
- `assembleDebug`
- `bundleRelease`

## Real-device or emulator acceptance

Test a clean install and an upgrade from the currently published internal-test build.

1. Launch
   - RAWAJ icon is correct.
   - system splash and native intro are branded.
   - no white screen on normal, slow, or offline startup.
   - intro runs only for a fresh Activity, not normal navigation.
   - local retry page appears when the production origin cannot load.

2. Google OAuth
   - start from a protected destination and preserve its `returnTo`.
   - Chrome opens for Google authentication.
   - the app resumes automatically after consent.
   - `/auth/callback` exchanges the code successfully.
   - the user lands on the intended destination.
   - close and reopen the app; the session remains signed in.
   - sign out; reopening the app remains signed out.

3. Session lifecycle
   - background the app long enough to exercise token refresh, then resume.
   - an expired or rejected refresh token returns to signed-out state without a loop.
   - Chrome's own web session does not falsely sign the WebView in.

4. Deep links
   - open `https://rawa-j.com` from another app.
   - open a listing URL from another app.
   - request password recovery inside the Android app and open the email link.
   - verify custom callback links only accept host `auth` and path `/callback`.
   - verify repeated callbacks do not reload in a loop.

5. Native navigation
   - Android Back traverses WebView history before exiting.
   - RAWAJ links stay inside the app.
   - WhatsApp, `tel:`, `mailto:`, and Google Maps links open the appropriate external app.

## Release prohibition

Do not upload the generated AAB to Google Play and do not mark the PR ready to merge until the real-device acceptance list is signed off.
