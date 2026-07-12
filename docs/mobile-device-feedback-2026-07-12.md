# RAWAJ mobile device feedback — 2026-07-12

This record captures defects observed on the first Android 1.0.3 device build and the corresponding stabilization work kept in PR #289.

## Confirmed defects

- Android showed an obsolete branded system splash before the newer native intro.
- The native intro held the screen longer than appropriate for a marketplace app.
- Launcher artwork filled too much of the adaptive-icon tile.
- Home did not support the expected pull-down refresh gesture.
- Arabic text was not vertically balanced in some form controls inside Android WebView.
- Messages could open into a blank or confusing mobile workspace instead of a conversation list.
- The mobile conversation journey did not feel direct when selecting a participant.
- The normal message composer exposed an unrelated optional block-reason field.
- Listing submission did not require explicit responsibility and policy acceptance.

## Stabilization applied

- replaced the visible Android system artwork with a seamless dark hand-off and retained one short RAWAJ intro
- reduced intro size, delays, minimum visibility, maximum wait, and fade duration
- inset adaptive and legacy launcher artwork inside a balanced safe zone
- added native-only pull-to-refresh backed by home-route invalidation
- normalized single-line input and select height, padding, line height, and text alignment
- rebuilt mobile Messages around designed loading, retry, empty, list, and thread states
- kept the list as the initial mobile view; selecting a participant opens that exact thread
- added realtime-backed online/offline indicators and incoming-message updates
- hid the overview content while a mobile thread is open and removed composer clutter
- added explicit Terms, prohibited-content, and privacy acceptance before review submission
- retained policy version and acceptance time in submitted listing details

## Non-negotiable release rule

The pull request remains draft. A replacement debug APK must pass the documented real-device matrix before merge or Google Play upload.
