# RAWAJ Android OAuth clean port — 1.0.3

This branch ports the Android OAuth and native runtime work onto the current `main` without merging the stale, broad PR #289.

## Automated evidence

The focused readiness workflow must pass all of the following from one commit:

- Android OAuth source contract;
- changed native/web ESLint;
- TypeScript;
- production web build;
- Capacitor Android sync;
- debug APK generation;
- release AAB generation without upload.

The generated release AAB is validation evidence only. It is not publication approval and may not be Play-ready until signing is verified.

## Required external configuration

1. Supabase Authentication redirect URLs must include:
   - `com.rawaj.marketplace://auth/callback`
   - `https://rawa-j.com/auth/callback`
2. `https://rawa-j.com/.well-known/assetlinks.json` must contain the real Google Play App Signing SHA-256 certificate fingerprint for package `com.rawaj.marketplace`.
3. Vercel must deploy the exact accepted web commit before Production Smoke and authenticated Production Acceptance are considered valid.

## Physical device or emulator acceptance

Do not merge this Draft PR or upload a new bundle until all checks below pass:

- Google OAuth opens the system browser and returns to the installed app;
- the callback exchanges a fresh PKCE authorization code;
- password recovery returns to the installed app;
- authenticated sessions survive app restart and WebView recreation;
- expired or rejected sessions refresh or sign out cleanly;
- explicit sign-out clears the native session;
- cold-start and warm-app custom links open the correct RAWAJ route;
- verified HTTPS App Links open inside the app;
- Android Back traverses WebView history before closing the app;
- WhatsApp, telephone, email, maps, market, and approved external links leave the WebView safely;
- camera and file selection still work for listing photos;
- slow and offline startup show a recoverable RAWAJ state;
- upgrading from the currently installed testing version preserves expected user state.

## Release identity

- package: `com.rawaj.marketplace`
- versionCode: `4`
- versionName: `1.0.3`

Version and signing changes require a new release decision and must not be inferred from automated debug/release builds.
