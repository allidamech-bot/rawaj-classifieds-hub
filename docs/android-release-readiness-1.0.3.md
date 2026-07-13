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

## Device-feedback stabilization included in this branch

The first real-device pass exposed several presentation and journey defects. The branch now includes the following corrections and they must be retested in the replacement APK:

- one seamless dark Android launch hand-off instead of an old splash followed by a second intro
- a shorter readiness-aware RAWAJ intro with a bounded maximum wait
- launcher artwork inset inside Android's adaptive-icon safe zone
- native pull-to-refresh on the home page
- vertically centered Arabic text in inputs and selects
- an app-like mobile conversation list instead of an empty or white message surface
- explicit loading, error, empty, and retry states for messages
- participant online/offline indicators and realtime incoming-message updates
- opening a participant row navigates directly into that conversation on mobile
- the conversation view hides the overview hero and safety card so the chat opens immediately
- the normal message composer no longer exposes the unrelated block-reason field
- listing submission requires explicit acceptance of the Terms of Use and prohibited-content policy
- the accepted policy version and timestamp are retained in the listing details submitted for review

## Automated gates

All pull-request workflows must be green:

- `Quality Gate`
- `Browser Smoke`
- `Android Release Readiness`

The Android workflow must complete:

- Android readiness contract
- mobile stabilization contract
- TypeScript typecheck
- production web build
- `npx cap sync android`
- `assembleDebug`
- `apksigner verify` proves the device-test APK carries the Android debug signature
- `bundleRelease`
- the release AAB must exist and be inspected in CI, but it is never uploaded by this workflow

## Real-device or emulator acceptance

Test a clean install and an upgrade from the currently published internal-test build.

1. Launch
   - RAWAJ icon has balanced padding and is not cropped or filling the whole launcher tile.
   - only the short RAWAJ intro is visibly presented after Android's dark hand-off.
   - no obsolete splash artwork appears before the intro.
   - no white screen appears on normal, slow, or offline startup.
   - intro runs only for a fresh Activity, not normal navigation.
   - local retry page appears when the production origin cannot load.

2. Home and forms
   - pulling down from the top of the home page refreshes its loader data once.
   - the refresh gesture does not trigger while the page is already scrolled.
   - Arabic labels, placeholders, entered text, and selected values are vertically centered.
   - text is not clipped above or below inputs, selects, textareas, or buttons.

3. Conversations
   - the main Messages tab opens a designed list, loading state, empty state, or error state; never a blank white page.
   - conversation rows show participant, listing, latest message, unread count, and online/offline status.
   - tapping the participant/conversation row opens the matching thread directly.
   - the mobile thread opens at the chat header and message stream, not behind a large overview block.
   - incoming messages appear without manually reopening the thread when realtime is available.
   - sending a message does not duplicate it.
   - Android Back returns from the thread to the conversation list before leaving Messages.
   - block and report actions remain available without cluttering the normal composer.

4. Listing responsibility acceptance
   - the final listing step shows links to Terms, prohibited content, and privacy.
   - Submit remains unavailable until the responsibility checkbox is accepted.
   - refusing the checkbox prevents review submission.
   - accepted submissions retain the policy version and acceptance timestamp.

5. Google OAuth
   - start from a protected destination and preserve its `returnTo`.
   - Chrome opens for Google authentication.
   - the app resumes automatically after consent.
   - `/auth/callback` exchanges the code successfully.
   - the user lands on the intended destination.
   - close and reopen the app; the session remains signed in.
   - sign out; reopening the app remains signed out.

6. Session lifecycle
   - background the app long enough to exercise token refresh, then resume.
   - an expired or rejected refresh token returns to signed-out state without a loop.
   - Chrome's own web session does not falsely sign the WebView in.

7. Deep links
   - open `https://rawa-j.com` from another app.
   - open a listing URL from another app.
   - request password recovery inside the Android app and open the email link.
   - verify custom callback links only accept host `auth` and path `/callback`.
   - verify repeated callbacks do not reload in a loop.

8. Native navigation and external intents
   - Android Back traverses WebView history before exiting.
   - RAWAJ links stay inside the app.
   - WhatsApp, `tel:`, `mailto:`, and Google Maps links open the appropriate external app.

## Release prohibition

Do not upload the generated AAB to Google Play and do not mark the PR ready to merge until the replacement APK passes this real-device acceptance list.
