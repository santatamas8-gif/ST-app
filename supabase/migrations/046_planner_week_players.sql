-- =============================================================================
-- GPS Load Planner — Persistent Week Squad membership
-- =============================================================================
-- DO NOT apply this migration automatically.
-- Apply only after Lead + gps-planner-database + gps-planner-qa review,
-- via explicit Supabase SQL run / controlled migrate step.
-- Do not push or run against live DB from agents.
--
-- Authority: docs/GPS_LOAD_PLANNER_MASTER_SPEC.md §J2 / §X
-- Purpose: week-scoped saved Planner squad / persisted default selection.
-- This is NOT a season/team roster, target owner, or group owner.
--
-- Access: ADMIN ONLY. Staff and Player must have ZERO policies.
-- No UPDATE policy: membership rows have no mutable product state.
-- Presence of a row = player belongs to that week's saved squad.
--
-- Membership must NOT cascade into:
--   planner_weekly_targets
--   planner_daily_targets
--   planner_match_best_snapshots
-- =============================================================================

CREATE TABLE public.planner_week_players (
  week_id uuid NOT NULL REFERENCES public.planner_weeks(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (week_id, player_id)
);

COMMENT ON TABLE public.planner_week_players IS
  'ADMIN-ONLY week-scoped saved Planner squad. Row exists = membership. Not a team/season roster. Does not own Weekly/Daily Targets or Match Best snapshots.';

COMMENT ON COLUMN public.planner_week_players.week_id IS
  'Planner week. Deleting the week removes membership rows only.';

COMMENT ON COLUMN public.planner_week_players.player_id IS
  'ST-AMS player identity (auth.users.id = profiles.id). Same convention as planner_group_members and planner_match_best_snapshots.';

COMMENT ON COLUMN public.planner_week_players.created_by IS
  'Admin who persisted membership. NULL for legacy Weekly Target backfill.';

ALTER TABLE public.planner_week_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_week_players_admin_select"
  ON public.planner_week_players FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin');

CREATE POLICY "planner_week_players_admin_insert"
  ON public.planner_week_players FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "planner_week_players_admin_delete"
  ON public.planner_week_players FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Legacy backfill: DISTINCT week_id + player_id from planner_weekly_targets.
-- One-way. Does not update/delete targets or snapshots. No Power BI.
-- Weeks with no Weekly Targets receive zero rows (correct).
-- Duplicate-safe: weekly PK is already (week_id, player_id); ON CONFLICT
-- protects a manual re-run.
-- ---------------------------------------------------------------------------
INSERT INTO public.planner_week_players (week_id, player_id)
SELECT DISTINCT t.week_id, t.player_id
FROM public.planner_weekly_targets t
ON CONFLICT (week_id, player_id) DO NOTHING;

-- =============================================================================
-- End Persistent Week Squad membership (not applied by this file creation alone)
-- =============================================================================
