type Value = string | number | null;

type Row = Record<string, unknown>;

interface Statement {
  bind(...values: Value[]): Statement;
  first<T = Row>(): Promise<T | null>;
}

interface Database {
  prepare(query: string): Statement;
}

export interface ProfileMediaCacheEnv {
  DB: Database;
}

const PROFILE_MEDIA_PATH = /^\/v1\/media\/assets\/([^/]+)$/;

export async function applyProfileMediaCachePolicy(
  path: string,
  response: Response,
  env: ProfileMediaCacheEnv,
): Promise<Response> {
  const match = path.match(PROFILE_MEDIA_PATH);
  if (!match || response.status !== 200) return response;

  let assetId: string;
  try {
    assetId = decodeURIComponent(match[1]);
  } catch {
    return response;
  }

  try {
    const profileUsage = await env.DB.prepare(
      `SELECT 1 AS used_by_profile
         FROM public_profiles
        WHERE avatar_asset_id = ? OR cover_asset_id = ?
        LIMIT 1`,
    )
      .bind(assetId, assetId)
      .first<{ used_by_profile: number }>();

    return profileUsage ? noStore(response) : response;
  } catch (error) {
    console.error("rawaj_profile_media_cache_policy_failed", {
      assetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return noStore(response);
  }
}

function noStore(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  headers.delete("Expires");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
