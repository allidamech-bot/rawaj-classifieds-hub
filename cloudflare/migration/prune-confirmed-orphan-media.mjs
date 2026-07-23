import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

const EXPECTED_BUCKET = 'ad-placement-media';
const EXPECTED_TOTAL_BYTES = 11_780_308;
const EXPECTED_PATHS = [
  '90fc1187-0357-46da-9c19-d984536df794/997ca3c1-2122-4a95-a2a1-82de318ffb7f.png',
  '90fc1187-0357-46da-9c19-d984536df794/7f68d16c-1cf8-49db-b152-0418d35e6949.png',
  '90fc1187-0357-46da-9c19-d984536df794/7051d348-e856-4c9f-bcb0-373e80613621.png',
  '90fc1187-0357-46da-9c19-d984536df794/c33e4ecd-c98a-4ee1-8495-b2968a24940c.png',
  '90fc1187-0357-46da-9c19-d984536df794/356cba5a-ea2d-42d4-85f0-6253df674867.png',
  '90fc1187-0357-46da-9c19-d984536df794/4931996b-4629-4b43-ab47-556a076e599a.png',
].sort();

const requiredEnv = [
  'SUPABASE_DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RAWAJ_CONFIRMED_ORPHAN_DELETE',
];

for (const name of requiredEnv) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

if (process.env.RAWAJ_CONFIRMED_ORPHAN_DELETE !== 'DELETE_EXACTLY_6_CONFIRMED_ORPHANS') {
  throw new Error('Deletion confirmation does not match the required safety phrase.');
}

const sql = postgres(process.env.SUPABASE_DATABASE_URL, {
  max: 1,
  prepare: false,
  ssl: 'require',
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function pathFromPublicUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${EXPECTED_BUCKET}/`;
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return null;
    return decodeURIComponent(parsed.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

try {
  const objects = await sql`
    select name,
           coalesce((metadata->>'size')::bigint, 0) as size_bytes
    from storage.objects
    where bucket_id = ${EXPECTED_BUCKET}
      and name = any(${sql.array(EXPECTED_PATHS)})
    order by name
  `;

  const referencedUrls = await sql`
    select image_url
    from public.ad_placements
    where image_url is not null
  `;

  const referencedPaths = new Set(
    referencedUrls.map((row) => pathFromPublicUrl(row.image_url)).filter(Boolean),
  );

  const actualPaths = objects.map((row) => row.name).sort();
  const actualBytes = objects.reduce((sum, row) => sum + Number(row.size_bytes), 0);

  if (actualPaths.length !== EXPECTED_PATHS.length) {
    throw new Error(`Safety stop: expected 6 objects, found ${actualPaths.length}.`);
  }

  if (JSON.stringify(actualPaths) !== JSON.stringify(EXPECTED_PATHS)) {
    throw new Error('Safety stop: current object paths differ from the reviewed allowlist.');
  }

  if (actualBytes !== EXPECTED_TOTAL_BYTES) {
    throw new Error(`Safety stop: expected ${EXPECTED_TOTAL_BYTES} bytes, found ${actualBytes}.`);
  }

  const nowReferenced = actualPaths.filter((path) => referencedPaths.has(path));
  if (nowReferenced.length > 0) {
    throw new Error(`Safety stop: object(s) became referenced: ${nowReferenced.join(', ')}`);
  }

  const { data, error } = await supabase.storage
    .from(EXPECTED_BUCKET)
    .remove(actualPaths);

  if (error) throw error;

  const deletedPaths = (data ?? []).map((item) => item.name).sort();
  if (JSON.stringify(deletedPaths) !== JSON.stringify(EXPECTED_PATHS)) {
    throw new Error(
      `Storage returned an unexpected deletion result. Expected ${EXPECTED_PATHS.length}, got ${deletedPaths.length}.`,
    );
  }

  const remaining = await sql`
    select name
    from storage.objects
    where bucket_id = ${EXPECTED_BUCKET}
      and name = any(${sql.array(EXPECTED_PATHS)})
  `;

  if (remaining.length > 0) {
    throw new Error(`Post-delete verification failed; ${remaining.length} objects remain.`);
  }

  console.log(JSON.stringify({
    ok: true,
    bucket: EXPECTED_BUCKET,
    deleted_count: deletedPaths.length,
    deleted_bytes: EXPECTED_TOTAL_BYTES,
    deleted_paths: deletedPaths,
  }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
