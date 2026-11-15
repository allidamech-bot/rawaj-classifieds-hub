// A Cloudflare 1027 page is returned before Worker code executes. Rate limits
// within the Worker cannot prevent quota exhaustion or repair an exhausted day.
// This circuit only avoids redundant READ requests while the edge is unavailable.
const WORKER_1027_READ_COOLDOWN_MS = 2 * 60_000;
let blockedUntilMs = 0;

export function isWorkerQuotaReadCooldownActive(now = Date.now()): boolean {
  return now < blockedUntilMs;
}

export async function observeWorkerQuotaResponse(
  response: Response,
  now = Date.now(),
): Promise<boolean> {
  // Do not mistake the Worker's normal JSON "rate_limited" response for
  // account-level Error 1027, and do not punish ordinary 4xx responses.
  if (response.status !== 429) return false;
  const contentType = (response.headers.get("Content-Type") ?? "").toLowerCase();
  if (contentType.includes("json")) return false;

  // Cloudflare has returned an HTML error page with this code when the daily
  // quota is exceeded. Read only a bounded clone of this 429 response.
  const page = await response
    .clone()
    .text()
    .then((body) => body.slice(0, 8_192))
    .catch(() => "");
  if (!/\b1027\b/.test(page)) return false;

  blockedUntilMs = Math.max(blockedUntilMs, now + WORKER_1027_READ_COOLDOWN_MS);
  return true;
}
