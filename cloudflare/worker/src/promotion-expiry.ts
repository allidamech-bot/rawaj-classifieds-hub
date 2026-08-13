type Value = string | number | null;
type Row = Record<string, unknown>;

interface Result<T = Row> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: { changes?: number };
}

interface Statement {
  bind(...values: Value[]): Statement;
  run(): Promise<Result>;
}

interface Database {
  prepare(query: string): Statement;
  batch(statements: Statement[]): Promise<Result[]>;
}

export interface TimedPromotionExpiryEnv {
  DB: Database;
}

export async function expireTimedPromotions(
  env: TimedPromotionExpiryEnv,
  timestamp = new Date().toISOString(),
): Promise<void> {
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE listing_promotion_requests
          SET status = 'expired', updated_at = ?
        WHERE status = 'approved'
          AND ends_at IS NOT NULL
          AND ends_at <= ?`,
    ).bind(timestamp, timestamp),
    env.DB.prepare(
      `UPDATE listings
          SET is_featured = CASE
                WHEN EXISTS (
                  SELECT 1
                    FROM listing_promotion_requests active
                   WHERE active.listing_id = listings.id
                     AND active.status = 'approved'
                     AND active.ends_at IS NOT NULL
                     AND active.ends_at > ?
                ) THEN 1
                ELSE 0
              END,
              featured_until = (
                SELECT MAX(active.ends_at)
                  FROM listing_promotion_requests active
                 WHERE active.listing_id = listings.id
                   AND active.status = 'approved'
                   AND active.ends_at IS NOT NULL
                   AND active.ends_at > ?
              ),
              updated_at = ?
        WHERE is_featured = 1
          AND featured_until IS NOT NULL
          AND featured_until <= ?`,
    ).bind(timestamp, timestamp, timestamp, timestamp),
  ]);

  const failed = results.find((result) => !result.success);
  if (failed) throw new Error(`timed_promotion_expiry_failed:${failed.error ?? "unknown"}`);

  const expiredPromotions = Number(results[0]?.meta?.changes ?? 0);
  const reconciledListings = Number(results[1]?.meta?.changes ?? 0);
  if (expiredPromotions > 0 || reconciledListings > 0) {
    console.log(JSON.stringify({ event: "timed_promotions_expired", timestamp, expiredPromotions, reconciledListings }));
  }
}
