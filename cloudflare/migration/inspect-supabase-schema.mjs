import postgres from "postgres";

const sql = postgres(process.env.SUPABASE_DATABASE_URL, {
  ssl: "require",
  prepare: false,
});

const rows = await sql.unsafe(`
  SELECT table_schema, table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema IN ('public', 'auth')
    AND table_name IN (
      'users',
      'identities',
      'profiles',
      'user_roles',
      'listings',
      'listing_taxonomy_assignments',
      'conversations',
      'messages',
      'seller_reviews',
      'support_requests'
    )
  ORDER BY table_schema, table_name, ordinal_position
`);

console.table(rows);
await sql.end();
