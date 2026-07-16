-- RAWAJ Phase 0 messaging hardening — make the live-chat subscriptions operational.
--
-- The web client subscribes to postgres_changes for conversations and conversation_messages.
-- Supabase only emits those changes when the tables belong to the supabase_realtime publication.
-- This migration fails closed when the expected publication or tables are missing, and adds each
-- table idempotently when Production has not already enabled it through the Dashboard.

DO $$
DECLARE
  v_table_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'Required publication supabase_realtime does not exist.';
  END IF;

  FOREACH v_table_name IN ARRAY ARRAY['conversations', 'conversation_messages']
  LOOP
    IF to_regclass(format('public.%I', v_table_name)) IS NULL THEN
      RAISE EXCEPTION 'Required Realtime table public.% does not exist.', v_table_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = v_table_name
    ) THEN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
        v_table_name
      );
    END IF;
  END LOOP;
END;
$$;

-- Realtime authorization evaluates the authenticated role against the existing participant-only
-- SELECT policies. Anonymous users must not gain table visibility from publication membership.
GRANT SELECT ON TABLE public.conversations TO authenticated;
GRANT SELECT ON TABLE public.conversation_messages TO authenticated;
REVOKE SELECT ON TABLE public.conversations FROM anon;
REVOKE SELECT ON TABLE public.conversation_messages FROM anon;

COMMENT ON TABLE public.conversations IS
  'Participant-scoped RAWAJ conversations; included in supabase_realtime for live chat updates.';

COMMENT ON TABLE public.conversation_messages IS
  'Participant-scoped RAWAJ messages; included in supabase_realtime for live chat updates.';
