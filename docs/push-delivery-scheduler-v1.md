# RAWAJ Push Delivery Scheduler V1

## Purpose

Run the already-deployed `send-push-notifications` Supabase Edge Function every 15 minutes so that:

1. due saved-search matches are aggregated into notifications;
2. pending or retryable push deliveries are claimed;
3. FCM messages are sent;
4. permanent invalid-device tokens are disabled;
5. each run exposes a sanitized summary in GitHub Actions.

## Security model

- The worker URL is public metadata, but the worker rejects calls without `x-cron-secret`.
- GitHub stores only the dedicated `PUSH_CRON_SECRET` repository secret.
- The scheduler does not receive the Supabase service-role key or Firebase private key.
- Secret values are never printed or added to the workflow summary.
- The worker itself keeps service-role and Firebase credentials inside Supabase Edge Function secrets.

## Cost and activation gate

Scheduled runner allocation is disabled by default. The scheduled job starts only when the repository variable `PUSH_SCHEDULER_ENABLED` is exactly `true`. Manual workflow dispatch remains available before activation so configuration can be checked without turning on recurring runs.

Activate automatic delivery in this order:

1. Configure the GitHub Actions repository secret named exactly `PUSH_CRON_SECRET`.
2. Use **Push Delivery Scheduler → Run workflow** and verify the summary reports HTTP 200 with `ok: true`.
3. Configure the GitHub Actions repository variable `PUSH_SCHEDULER_ENABLED` with value `true`.

The secret value must match the existing `PUSH_CRON_SECRET` configured for the deployed Supabase Edge Function. Do not store it in source control, issues, pull requests, screenshots, or logs.

When the activation variable is true but the secret is missing, the workflow fails clearly instead of pretending that scheduled delivery is operational. When neither is configured, scheduled events do not allocate a runner; a manually dispatched run skips safely and performs no network call.

## Operational summary

Each successful run reports only counters:

- saved-search users checked;
- saved searches flushed;
- matching listings;
- notifications created;
- deliveries claimed;
- deliveries sent;
- deliveries queued for retry;
- invalid devices disabled.

No device token, message body, credential, or private user data is written to the summary.

## Failure behavior

- Network failures use two bounded retries.
- Connection timeout is 15 seconds.
- Total request time is capped at 120 seconds.
- Curl/network failures, HTTP failures, and worker responses with `ok: false` fail the workflow.
- Database delivery rows retain their retry state; the next run can reclaim eligible work.
- Concurrency prevents overlapping scheduler runs.

## Rollback

Set `PUSH_SCHEDULER_ENABLED` to `false` or remove the variable. The notification and push queue data remain intact, and the worker can still be invoked manually for recovery. Removing `PUSH_CRON_SECRET` additionally prevents manual delivery calls from GitHub Actions.
