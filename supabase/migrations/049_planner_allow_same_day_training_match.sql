-- =============================================================================
-- GPS Load Planner — Phase SDM-C: allow same-date Training + Match
-- =============================================================================
-- DO NOT apply this migration automatically.
-- Apply only after Lead + gps-planner-database + gps-planner-qa review,
-- via explicit Supabase SQL run / controlled migrate step.
-- Do not push or run against live DB from agents.
--
-- Authority: docs/GPS_LOAD_PLANNER_MASTER_SPEC.md §N2 / Date uniqueness
-- Purpose: drop only the 045 cross-type collision triggers so one Training day
-- and one Official Match may share a calendar date in the same Planner week.
--
-- DO NOT:
--   drop UNIQUE (week_id, date) on planner_week_days
--   drop UNIQUE (week_id, gps_date) on planner_week_official_matches
--   drop UNIQUE (week_id, match_order)
--   change Training Actual, Match Actual, targets, RLS, or existing rows
-- =============================================================================

DROP TRIGGER IF EXISTS planner_week_official_matches_reject_training_date
  ON public.planner_week_official_matches;

DROP TRIGGER IF EXISTS planner_week_days_reject_match_date
  ON public.planner_week_days;

DROP FUNCTION IF EXISTS public.planner_week_official_matches_reject_training_date();

DROP FUNCTION IF EXISTS public.planner_week_days_reject_match_date();

COMMENT ON TABLE public.planner_week_official_matches IS
  'ADMIN-ONLY Match identity/display for Total Load. 0–2 rows per week (UNIQUE week_id+match_order and week_id+gps_date). gps_date may fall outside planner_weeks.start_date..end_date. Same Planner week/date MAY contain one Training day and one Official Match. Training days remain unique by (week_id, date). Official Matches remain unique by (week_id, gps_date). No GPS Actual columns.';

-- =============================================================================
-- End Phase SDM-C same-date Training + Match unlock
-- =============================================================================
