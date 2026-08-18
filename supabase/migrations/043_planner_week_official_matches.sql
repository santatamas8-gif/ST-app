-- =============================================================================
-- GPS Load Planner — Total Load Phase 1: official match persistence
-- =============================================================================
-- DO NOT apply this migration automatically.
-- Apply only after Lead + gps-planner-database + gps-planner-qa review,
-- via explicit Supabase SQL run / controlled migrate step.
-- Do not push or run against live DB from agents.
--
-- Authority: docs/GPS_LOAD_PLANNER_MASTER_SPEC.md §U3 / §X
-- Access: ADMIN ONLY. Staff and Player must have ZERO policies.
-- Persist identity / display metadata only. Do NOT store GPS Actuals.
-- Intentionally NO CHECK that gps_date is inside planner_weeks.start_date..end_date.
-- =============================================================================

CREATE TABLE public.planner_week_official_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.planner_weeks(id) ON DELETE CASCADE,
  gps_date date NOT NULL,
  opponent text NOT NULL,
  matchday text NOT NULL,
  competition text NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planner_week_official_matches_week_id_key
    UNIQUE (week_id),
  CONSTRAINT planner_week_official_matches_opponent_trim_check
    CHECK (length(trim(opponent)) > 0),
  CONSTRAINT planner_week_official_matches_matchday_trim_check
    CHECK (length(trim(matchday)) > 0),
  CONSTRAINT planner_week_official_matches_competition_trim_check
    CHECK (competition IS NULL OR length(trim(competition)) > 0)
);

COMMENT ON TABLE public.planner_week_official_matches IS
  'ADMIN-ONLY Total Load official match selection (one per planner week). Identity/display only; gps_date may fall outside planner_weeks.start_date..end_date. No GPS Actual columns.';

COMMENT ON COLUMN public.planner_week_official_matches.gps_date IS
  'Admin-selected GPS_Log Date. May fall outside the stored planner week training date range.';

COMMENT ON COLUMN public.planner_week_official_matches.opponent IS
  'Frozen display opponent at Admin save. Not a live Power BI lookup.';

COMMENT ON COLUMN public.planner_week_official_matches.matchday IS
  'Frozen display matchday at Admin save. Not a live Power BI lookup.';

COMMENT ON COLUMN public.planner_week_official_matches.competition IS
  'Frozen display competition at Admin save. Nullable.';

CREATE TRIGGER planner_week_official_matches_set_updated_at
  BEFORE UPDATE ON public.planner_week_official_matches
  FOR EACH ROW
  EXECUTE PROCEDURE public.planner_set_updated_at();

ALTER TABLE public.planner_week_official_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_week_official_matches_admin_select"
  ON public.planner_week_official_matches FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin');

CREATE POLICY "planner_week_official_matches_admin_insert"
  ON public.planner_week_official_matches FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "planner_week_official_matches_admin_update"
  ON public.planner_week_official_matches FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "planner_week_official_matches_admin_delete"
  ON public.planner_week_official_matches FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'admin');

-- =============================================================================
-- End official-match persistence (not applied by this file creation alone)
-- =============================================================================
