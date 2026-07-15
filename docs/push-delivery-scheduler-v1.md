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

## Activation gate

The scheduled job is intentionally safe before configuration. When `PUSH_CRON_SECRET` is absent, it exits successfully with a clear “skipped safely” notice and performs no network call.

To activate automatic delivery, configure the GitHub Actions repository secret named exactly:

```text
PUSH_CRON_SECRET
```

Its value must match the existing `PUSH_CRON_SECRET` configured for the deployed Supabase Edge Function. Do not store the value in source control, issues, pull requests, screenshots, or logs.

After the secret is configured, run **Push Delivery Scheduler → Run workflow** once and verify the summary reports HTTP 200 with `ok: true`. Scheduled execution then continues every 15 minutes.

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
- HTTP failures and worker responses with `ok: false` fail the workflow.
- Database delivery rows retain their retry state; the next run can reclaim eligible work.
- Concurrency prevents overlapping scheduler runs.

## Rollback

Disable the workflow from GitHub Actions or remove the `PUSH_CRON_SECRET` repository secret. The notification and push queue data remain intact, and the worker can still be invoked manually for recovery.
