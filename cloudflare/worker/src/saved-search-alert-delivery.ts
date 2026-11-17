import { countNewSavedSearchMatches, type PublicListingsEnv } from "./public-listings";

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
  all<T = Row>(): Promise<Result<T>>;
  run(): Promise<Result>;
}
interface Database {
  prepare(query: string): Statement;
  batch(statements: Statement[]): Promise<Result[]>;
}

export interface SavedSearchAlertsEnv {
  DB: Database & PublicListingsEnv["DB"];
}

interface DueSearch {
  id: string;
  user_id: string;
  name_ar: string | null;
  filters: string | null;
  query: string;
  last_alert_checked_at: string | null;
  created_at: string;
  updated_at: string;
  alert_frequency: "daily" | "weekly";
}

const MAX_SEARCHES_PER_RUN = 20;

/**
 * Server-side only. One summary per due search, not one notification per listing.
 * Advance the watermark atomically with notification insertion; concurrent runs
 * cannot create duplicate notifications or overwrite a newer search edit.
 */
export async function deliverDueSavedSearchAlerts(
  env: SavedSearchAlertsEnv,
  timestamp: string,
): Promise<void> {
  const now = Date.parse(timestamp);
  if (!Number.isFinite(now)) throw new Error("invalid_saved_search_scan_time");
  const daily = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const weekly = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const due = await env.DB.prepare(
    `SELECT s.id, s.user_id, s.name_ar, s.filters, s.query, s.last_alert_checked_at,
            s.created_at, s.updated_at, s.alert_frequency
       FROM saved_searches s
       JOIN public_profiles p ON p.id = s.user_id AND p.account_status = 'active'
      WHERE s.alerts_enabled = 1
        AND (
          (s.alert_frequency = 'daily' AND COALESCE(s.last_alert_checked_at, s.created_at) <= ?)
          OR (s.alert_frequency = 'weekly' AND COALESCE(s.last_alert_checked_at, s.created_at) <= ?)
        )
      ORDER BY COALESCE(s.last_alert_checked_at, s.created_at), s.id
      LIMIT ?`,
  )
    .bind(daily, weekly, MAX_SEARCHES_PER_RUN)
    .all<DueSearch>();
  if (!due.success) throw new Error("saved_search_due_query_failed");

  let failed = 0;
  for (const search of due.results ?? []) {
    try {
      await deliverSearch(env, search, timestamp);
    } catch (error) {
      failed += 1;
      console.error("rawaj_saved_search_alert_failed", search.id, error);
    }
  }
  if (failed) throw new Error(`saved_search_alerts_failed:${failed}`);
}

async function deliverSearch(env: SavedSearchAlertsEnv, search: DueSearch, timestamp: string) {
  const parsed: unknown = JSON.parse(search.filters ?? search.query);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid_stored_saved_search_filters");
  }
  const count = await countNewSavedSearchMatches(
    env,
    parsed as Row,
    search.user_id,
    search.last_alert_checked_at ?? search.created_at,
    timestamp,
  );
  const scope = `id = ? AND user_id = ? AND updated_at = ?
    AND last_alert_checked_at IS ? AND alerts_enabled = 1 AND alert_frequency = ?
    AND EXISTS (SELECT 1 FROM public_profiles p WHERE p.id = saved_searches.user_id
      AND p.account_status = 'active')`;
  const scopeValues: Value[] = [
    search.id,
    search.user_id,
    search.updated_at,
    search.last_alert_checked_at,
    search.alert_frequency,
  ];
  const statements: Statement[] = [];
  if (count > 0) {
    const name = search.name_ar?.trim().slice(0, 80) || "بحث محفوظ";
    statements.push(
      env.DB.prepare(
        `INSERT INTO notifications (id, user_id, type, title, body, data, created_at)
         SELECT ?, ?, 'saved_search.match', ?, ?, ?, ?
          WHERE EXISTS (SELECT 1 FROM saved_searches WHERE ${scope})
            AND COALESCE((SELECT saved_search_matches_enabled
              FROM notification_preferences WHERE user_id = ?), 1) = 1`,
      ).bind(
        crypto.randomUUID(),
        search.user_id,
        "نتائج جديدة في بحثك المحفوظ",
        `وجدنا ${count} إعلاناً جديداً يطابق بحثك: ${name}`,
        JSON.stringify({
          targetType: "saved_search",
          targetId: search.id,
          matchCount: count,
          titleEn: "New matches in your saved search",
          bodyEn: `${count} new listings match your saved search: ${name}`,
        }),
        timestamp,
        ...scopeValues,
        search.user_id,
      ),
    );
  }
  statements.push(
    env.DB.prepare(
      `UPDATE saved_searches SET last_alert_checked_at = ? WHERE ${scope}`,
    ).bind(timestamp, ...scopeValues),
  );
  const results = await env.DB.batch(statements);
  if (results.some((result) => !result.success)) throw new Error("saved_search_alert_batch_failed");
}
