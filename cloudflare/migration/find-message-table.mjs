import postgres from "postgres";

const sql = postgres(process.env.SUPABASE_DATABASE_URL, {
  ssl: "require",
  prepare: false,
});

const rows = await sql.unsafe(`
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (
      table_name ILIKE '%message%'
      OR table_name ILIKE '%chat%'
      OR table_name ILIKE '%conversation%'
    )
  ORDER BY table_name
`);

console.table(rows);
await sql.end();
