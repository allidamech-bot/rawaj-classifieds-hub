import postgres from "postgres";

const sql = postgres(process.env.SUPABASE_DATABASE_URL, {
  ssl: "require",
  prepare: false,
});

const rows = await sql.unsafe(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'conversation_messages'
  ORDER BY ordinal_position
`);

console.table(rows);
await sql.end();
