-- =============================================================================
-- GPS Load Planner — Two-Match Week V2 Phase D: enable 0–2 Match rows
-- =============================================================================
-- DO NOT apply this migration automatically.
-- Apply only after Lead + gps-planner-database + gps-planner-qa review,
-- via explicit Supabase SQL run / controlled migrate step.
-- Do not push or run against live DB from agents.
--
-- Purpose: drop obsolete UNIQUE (week_id) so a Planner week may store 0, 1, or
-- 2 official Match rows. Add symmetric Training/Match same-date collision
-- protection. Do not rewrite existing W4/W5 rows.
--
-- DO NOT:
--   drop UNIQUE (week_id, match_order)
--   drop UNIQUE (week_id, gps_date)
--   drop CHECK match_order IN (1, 2)
--   require gps_date inside planner_weeks.start_date..end_date
--   change planner_week_days_validate_date
--   change Admin-only RLS
--   insert or update existing official Match rows
--   require Match 1 before Match 2
--
-- After this migration, the database can store Match 2. Runtime UI still has
-- no path to create it. Do not seed a second production Match row.
-- =============================================================================

-- 1) Drop obsolete one-row-per-week uniqueness. Remaining uniqueness:
--    UNIQUE (week_id, match_order)  → at most one row per slot 1 or 2
--    UNIQUE (week_id, gps_date)     → at most one Match date per week
--    CHECK match_order IN (1, 2)    → no third slot
ALTER TABLE public.planner_week_official_matches
  DROP CONSTRAINT planner_week_official_matches_week_id_key;

-- 2) Match INSERT/UPDATE: reject if the same week already has that date as Training.
CREATE OR REPLACE FUNCTION public.planner_week_official_matches_reject_training_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.planner_week_days d
    WHERE d.week_id = NEW.week_id
      AND d.date = NEW.gps_date
  ) THEN
    RAISE EXCEPTION
      'planner_week_official_matches.gps_date % already exists as a Training day in planner_week_days for week_id %',
      NEW.gps_date, NEW.week_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER planner_week_official_matches_reject_training_date
  BEFORE INSERT OR UPDATE OF gps_date, week_id
  ON public.planner_week_official_matches
  FOR EACH ROW
  EXECUTE PROCEDURE public.planner_week_official_matches_reject_training_date();

-- 3) Training INSERT/UPDATE: reject if the same week already has that date as Match.
-- Does not replace planner_week_days_validate_date (week range stays unchanged).
CREATE OR REPLACE FUNCTION public.planner_week_days_reject_match_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.planner_week_official_matches m
    WHERE m.week_id = NEW.week_id
      AND m.gps_date = NEW.date
  ) THEN
    RAISE EXCEPTION
      'planner_week_days.date % already exists as a Match day in planner_week_official_matches for week_id %',
      NEW.date, NEW.week_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER planner_week_days_reject_match_date
  BEFORE INSERT OR UPDATE OF date, week_id
  ON public.planner_week_days
  FOR EACH ROW
  EXECUTE PROCEDURE public.planner_week_days_reject_match_date();

COMMENT ON COLUMN public.planner_week_official_matches.match_order IS
  'Stable Match slot for the planner week: 1 or 2. UNIQUE (week_id, match_order) allows at most two rows. md_tag is not unique.';

COMMENT ON TABLE public.planner_week_official_matches IS
  'ADMIN-ONLY Match identity/display for Total Load. 0–2 rows per week (UNIQUE week_id+match_order and week_id+gps_date). gps_date may fall outside planner_weeks.start_date..end_date. Same week/date cannot also be a Training day. No GPS Actual columns.';

-- =============================================================================
-- End Phase D enable 0–2 official Match rows (not applied by this file creation)
-- =============================================================================
