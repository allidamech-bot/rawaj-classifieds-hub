# Android release candidate integrity

## Purpose

This gate prepares a reproducible RAWAJ Android release candidate without signing, publishing,
or changing any external service. It is independent of the retired backend and does not authorize a Google
Play release.

## Repository-owned evidence

The **Android Release Candidate** workflow now:

1. validates TypeScript and Android media/deep-link contracts;
2. builds the production web assets and synchronizes Capacitor;
3. runs Android unit tests and produces both `bundleRelease` and `assembleRelease` outputs;
4. reads application ID, version code, and version name from the built APK with `apkanalyzer`;
5. compares the built identity with `android/app/build.gradle`;
6. rejects any CI APK or AAB that unexpectedly contains signing credentials;
7. generates SHA-256 checksums, file sizes, source commit evidence, and dynamic artifact names;
8. uploads the unsigned candidate and its evidence for review.

The workflow must never duplicate version constants in artifact names or README content. Version
identity is derived from the built artifact and checked against Gradle.

## Signing boundary

GitHub Actions deliberately produces unsigned candidates. No upload key, Play App Signing key,
service-account credential, or signing configuration belongs in this workflow.

Final release evidence remains external and manual:

- verify the final version code and version name;
- upload the reviewed AAB to Google Play Internal Testing;
- allow Google Play App Signing to sign the distributed build;
- obtain the real Play App Signing SHA-256 certificate fingerprint;
- configure and verify Digital Asset Links with that exact fingerprint;
- install from the Internal Testing track on a physical Android device;
- verify fresh install, upgrade, authentication, password recovery, App Links, push permissions,
  notifications, media permissions, and core marketplace journeys.

## Distribution rule

Unsigned CI artifacts are review evidence only. They must not be sent to users, sideloaded as a
production build, or treated as equivalent to the Play-signed Internal Testing artifact.

## Publication rule

Merging the Android release candidate gate does not upload or publish an app. Google Play upload,
track rollout, and production publication remain explicit manual owner actions after review.
