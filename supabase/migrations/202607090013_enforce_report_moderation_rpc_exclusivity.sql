-- RAWAJ report-moderation write-path exclusivity.
--
-- Listing-report and message-report moderation already use stale-safe,
-- authority-checked SECURITY DEFINER RPCs in the application layer. Remove the
-- legacy authenticated direct UPDATE policies so those RPCs are the only
-- supported moderation write paths. Existing rows are not rewritten.

-- Listing reports: preserve read and user-insert policies; remove only the
-- privileged direct UPDATE path.
drop policy if exists "Privileged moderators update listing reports"
  on public.listing_reports;

-- Message reports: preserve admin read and reporter-owned policies; remove only
-- the privileged direct UPDATE path.
drop policy if exists "message_reports_admin_update"
  on public.message_reports;
