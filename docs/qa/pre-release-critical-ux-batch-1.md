# RAWAJ pre-release critical UX — Batch 1

Baseline: `4444114fc0429175fff7cdbd9af0006c6ce7a143`

Release boundary: this batch does not upload Android 1.0.4 to Google Play and does not promote a Vercel deployment.

## Corrected in this batch

- `/listings` quick controls now open and focus their intended sections instead of all behaving like a generic filter button.
- Private chat audio automatically requests a fresh signed URL when the server response has no usable URL or the previous URL expired.
- The audio player deduplicates refresh requests and exposes a stable retry state.
- The messages route removes the oversized hero and safety blocks on mobile and uses the available screen for the conversation list or active chat.
- The desktop messages hero is compacted without changing Activity or Notifications.
- Currency presentation recognizes SYP, USD, EUR, and SAR, with SYP explicitly labelled as the new Syrian pound denomination.

## Not claimed complete by this batch

- End-to-end database persistence and filtering for EUR/SAR/USD.
- Existing old-SYP listing conversion and dual-denomination transition.
- Delivered/read receipts.
- Full taxonomy expansion.
- Advertising-space image lifecycle and crop tools.
- Complete performance audit.

Those remain tracked in issue #459 and must be completed before a release decision.
