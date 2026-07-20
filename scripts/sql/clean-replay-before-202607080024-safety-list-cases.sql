\set ON_ERROR_STOP on

-- RAWAJ clean-replay compatibility hook before
-- 202607080024_safety_case_assignment_escalation.sql.
--
-- PostgreSQL cannot change a function's OUT-column row type through
-- CREATE OR REPLACE FUNCTION. The escalation migration adds two columns to the
-- list-cases result, so the earlier signature must be dropped before the new
-- authoritative body is created.

drop function if exists public.rawaj_safety_list_cases(text, integer);
