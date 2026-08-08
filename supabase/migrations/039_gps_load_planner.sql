-- =============================================================================
-- GPS Load Planner V1 — schema + RLS (ADMIN ONLY)
-- =============================================================================
-- DO NOT apply this migration automatically.
-- Apply only after Lead + gps-planner-qa review, via explicit Supabase SQL run
-- / controlled migrate step. Do not push or run against live DB from agents.
--
-- Authority: docs/GPS_LOAD_PLANNER_MASTER_SPEC.md
-- Access: ADMIN ONLY for all planner tables + player_external_mappings.
-- Staff and Player must have ZERO policies (no SELECT/INSERT/UPDATE/DELETE).
-- Groups are WEEK-SCOPED; targets never FK to groups.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- updated_at helper (no project-wide reusable trigger exists)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.planner_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.planner_set_updated_at() IS
  'GPS Load Planner: sets NEW.updated_at = now() on BEFORE UPDATE.';

-- ---------------------------------------------------------------------------
-- 1) player_external_mappings
-- ---------------------------------------------------------------------------
CREATE TABLE public.player_external_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_player_name text NOT NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_external_mappings_provider_check
    CHECK (provider = 'powerbi'),
  CONSTRAINT player_external_mappings_external_player_name_trim_check
    CHECK (length(trim(external_player_name)) > 0),
  CONSTRAINT player_external_mappings_provider_player_id_key
    UNIQUE (provider, player_id),
  CONSTRAINT player_external_mappings_provider_external_player_name_key
    UNIQUE (provider, external_player_name)
);

COMMENT ON COLUMN public.player_external_mappings.external_player_name IS
  'Exact Power BI player name; case-sensitive; do not lowercase.';

CREATE TRIGGER player_external_mappings_set_updated_at
  BEFORE UPDATE ON public.player_external_mappings
  FOR EACH ROW
  EXECUTE PROCEDURE public.planner_set_updated_at();

ALTER TABLE public.player_external_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_external_mappings_admin_select"
  ON public.player_external_mappings FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin');

CREATE POLICY "player_external_mappings_admin_insert"
  ON public.player_external_mappings FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "player_external_mappings_admin_update"
  ON public.player_external_mappings FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "player_external_mappings_admin_delete"
  ON public.player_external_mappings FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 2) planner_weeks
-- ---------------------------------------------------------------------------
CREATE TABLE public.planner_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  powerbi_week_id text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  week_type text NOT NULL,
  overload_focus text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planner_weeks_powerbi_week_id_trim_check
    CHECK (length(trim(powerbi_week_id)) > 0),
  CONSTRAINT planner_weeks_date_range_check
    CHECK (end_date >= start_date),
  CONSTRAINT planner_weeks_week_type_check
    CHECK (week_type IN ('deload', 'maintaining', 'overload')),
  CONSTRAINT planner_weeks_overload_focus_values_check
    CHECK (overload_focus <@ ARRAY['td', 'hsr', 'sprint', 'acc', 'dec']::text[]),
  CONSTRAINT planner_weeks_overload_focus_empty_unless_overload_check
    CHECK (week_type = 'overload' OR overload_focus = '{}'::text[]),
  CONSTRAINT planner_weeks_status_check
    CHECK (status IN ('draft', 'active', 'closed')),
  CONSTRAINT planner_weeks_powerbi_week_id_start_date_key
    UNIQUE (powerbi_week_id, start_date)
);

CREATE INDEX planner_weeks_start_date_idx
  ON public.planner_weeks (start_date);

CREATE INDEX planner_weeks_status_idx
  ON public.planner_weeks (status);

CREATE TRIGGER planner_weeks_set_updated_at
  BEFORE UPDATE ON public.planner_weeks
  FOR EACH ROW
  EXECUTE PROCEDURE public.planner_set_updated_at();

-- Reject start_date/end_date updates that would leave existing week days outside the range.
-- Does not auto-delete, move, or rewrite planner_week_days rows.
CREATE OR REPLACE FUNCTION public.planner_weeks_validate_date_range()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.planner_week_days d
    WHERE d.week_id = NEW.id
      AND (d.date < NEW.start_date OR d.date > NEW.end_date)
  ) THEN
    RAISE EXCEPTION
      'planner_weeks: cannot set start_date % / end_date %; existing planner_week_days dates fall outside the range (week_id %)',
      NEW.start_date, NEW.end_date, NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER planner_weeks_validate_date_range
  BEFORE UPDATE OF start_date, end_date ON public.planner_weeks
  FOR EACH ROW
  EXECUTE PROCEDURE public.planner_weeks_validate_date_range();

ALTER TABLE public.planner_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_weeks_admin_select"
  ON public.planner_weeks FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin');

CREATE POLICY "planner_weeks_admin_insert"
  ON public.planner_weeks FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "planner_weeks_admin_update"
  ON public.planner_weeks FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "planner_weeks_admin_delete"
  ON public.planner_weeks FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 3) planner_week_days
-- ---------------------------------------------------------------------------
CREATE TABLE public.planner_week_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.planner_weeks(id) ON DELETE CASCADE,
  date date NOT NULL,
  md_tag text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planner_week_days_md_tag_trim_check
    CHECK (length(trim(md_tag)) > 0),
  CONSTRAINT planner_week_days_display_order_check
    CHECK (display_order >= 0),
  CONSTRAINT planner_week_days_week_id_date_key
    UNIQUE (week_id, date),
  CONSTRAINT planner_week_days_week_id_display_order_key
    UNIQUE (week_id, display_order),
  -- Required for composite FK from planner_daily_targets (week_day_id, week_id).
  -- Intentionally NOT UNIQUE (week_id, md_tag) — future two-match compatibility.
  CONSTRAINT planner_week_days_id_week_id_key
    UNIQUE (id, week_id)
);

-- Date must lie within parent planner_weeks.start_date..end_date (cross-table).
CREATE OR REPLACE FUNCTION public.planner_week_days_validate_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  week_start date;
  week_end date;
BEGIN
  SELECT w.start_date, w.end_date
    INTO week_start, week_end
  FROM public.planner_weeks w
  WHERE w.id = NEW.week_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'planner_week_days: week_id % not found', NEW.week_id;
  END IF;

  IF NEW.date < week_start OR NEW.date > week_end THEN
    RAISE EXCEPTION
      'planner_week_days.date % must be between planner_weeks.start_date % and end_date % (inclusive)',
      NEW.date, week_start, week_end;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER planner_week_days_validate_date
  BEFORE INSERT OR UPDATE OF date, week_id ON public.planner_week_days
  FOR EACH ROW
  EXECUTE PROCEDURE public.planner_week_days_validate_date();

ALTER TABLE public.planner_week_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_week_days_admin_select"
  ON public.planner_week_days FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin');

CREATE POLICY "planner_week_days_admin_insert"
  ON public.planner_week_days FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "planner_week_days_admin_update"
  ON public.planner_week_days FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "planner_week_days_admin_delete"
  ON public.planner_week_days FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 4) planner_groups (WEEK-SCOPED selection helpers; targets never FK here)
-- ---------------------------------------------------------------------------
CREATE TABLE public.planner_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.planner_weeks(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planner_groups_name_trim_check
    CHECK (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX planner_groups_week_id_lower_trim_name_uidx
  ON public.planner_groups (week_id, lower(trim(name)));

CREATE TRIGGER planner_groups_set_updated_at
  BEFORE UPDATE ON public.planner_groups
  FOR EACH ROW
  EXECUTE PROCEDURE public.planner_set_updated_at();

ALTER TABLE public.planner_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_groups_admin_select"
  ON public.planner_groups FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin');

CREATE POLICY "planner_groups_admin_insert"
  ON public.planner_groups FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "planner_groups_admin_update"
  ON public.planner_groups FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "planner_groups_admin_delete"
  ON public.planner_groups FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 5) planner_group_members (no cascade path to targets)
-- ---------------------------------------------------------------------------
CREATE TABLE public.planner_group_members (
  group_id uuid NOT NULL REFERENCES public.planner_groups(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (group_id, player_id)
);

ALTER TABLE public.planner_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_group_members_admin_select"
  ON public.planner_group_members FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin');

CREATE POLICY "planner_group_members_admin_insert"
  ON public.planner_group_members FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "planner_group_members_admin_update"
  ON public.planner_group_members FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "planner_group_members_admin_delete"
  ON public.planner_group_members FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 6) planner_match_best_snapshots (frozen; source fields immutable)
-- ---------------------------------------------------------------------------
CREATE TABLE public.planner_match_best_snapshots (
  week_id uuid NOT NULL REFERENCES public.planner_weeks(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  td_best numeric NOT NULL,
  hsr_best numeric NOT NULL,
  sprint_best numeric NOT NULL,
  acc_best numeric NOT NULL,
  dec_best numeric NOT NULL,
  powerbi_player_name text NOT NULL,
  source_method text NOT NULL DEFAULT 'single-match best',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (week_id, player_id),
  CONSTRAINT planner_match_best_snapshots_td_best_check CHECK (td_best >= 0),
  CONSTRAINT planner_match_best_snapshots_hsr_best_check CHECK (hsr_best >= 0),
  CONSTRAINT planner_match_best_snapshots_sprint_best_check CHECK (sprint_best >= 0),
  CONSTRAINT planner_match_best_snapshots_acc_best_check CHECK (acc_best >= 0),
  CONSTRAINT planner_match_best_snapshots_dec_best_check CHECK (dec_best >= 0),
  CONSTRAINT planner_match_best_snapshots_powerbi_player_name_trim_check
    CHECK (length(trim(powerbi_player_name)) > 0),
  CONSTRAINT planner_match_best_snapshots_source_method_check
    CHECK (source_method = 'single-match best')
);

COMMENT ON COLUMN public.planner_match_best_snapshots.powerbi_player_name IS
  'Frozen Power BI player name at snapshot time; case-sensitive; do not lowercase.';

-- Immutability: no UPDATE RLS policy (admin has SELECT/INSERT only; no DELETE policy).
-- Trigger rejects any UPDATE as defense-in-depth (e.g. service role / future policies).
-- Snapshots are deleted only via parent planner_weeks ON DELETE CASCADE.
-- FK CASCADE runs as the table owner and bypasses RLS when FORCE ROW LEVEL SECURITY
-- is not set (standard Supabase / PostgreSQL default for table owners).
CREATE OR REPLACE FUNCTION public.planner_match_best_snapshots_reject_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'planner_match_best_snapshots rows are immutable (week_id, player_id, metrics, powerbi_player_name, source_method); remove only by deleting the parent planner week';
END;
$$;

CREATE TRIGGER planner_match_best_snapshots_reject_update
  BEFORE UPDATE ON public.planner_match_best_snapshots
  FOR EACH ROW
  EXECUTE PROCEDURE public.planner_match_best_snapshots_reject_update();

ALTER TABLE public.planner_match_best_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_match_best_snapshots_admin_select"
  ON public.planner_match_best_snapshots FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin');

CREATE POLICY "planner_match_best_snapshots_admin_insert"
  ON public.planner_match_best_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

-- No UPDATE policy: RLS denies UPDATE for authenticated clients.
-- No DELETE policy: no admin delete-snapshot path; removal is week CASCADE only.

-- ---------------------------------------------------------------------------
-- 7) planner_weekly_targets
-- ---------------------------------------------------------------------------
CREATE TABLE public.planner_weekly_targets (
  week_id uuid NOT NULL,
  player_id uuid NOT NULL,
  td_pct numeric NOT NULL,
  hsr_pct numeric NOT NULL,
  sprint_pct numeric NOT NULL,
  acc_pct numeric NOT NULL,
  dec_pct numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (week_id, player_id),
  CONSTRAINT planner_weekly_targets_snapshot_fkey
    FOREIGN KEY (week_id, player_id)
    REFERENCES public.planner_match_best_snapshots (week_id, player_id)
    ON DELETE CASCADE,
  CONSTRAINT planner_weekly_targets_td_pct_check CHECK (td_pct >= 0),
  CONSTRAINT planner_weekly_targets_hsr_pct_check CHECK (hsr_pct >= 0),
  CONSTRAINT planner_weekly_targets_sprint_pct_check CHECK (sprint_pct >= 0),
  CONSTRAINT planner_weekly_targets_acc_pct_check CHECK (acc_pct >= 0),
  CONSTRAINT planner_weekly_targets_dec_pct_check CHECK (dec_pct >= 0)
);

CREATE TRIGGER planner_weekly_targets_set_updated_at
  BEFORE UPDATE ON public.planner_weekly_targets
  FOR EACH ROW
  EXECUTE PROCEDURE public.planner_set_updated_at();

ALTER TABLE public.planner_weekly_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_weekly_targets_admin_select"
  ON public.planner_weekly_targets FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin');

CREATE POLICY "planner_weekly_targets_admin_insert"
  ON public.planner_weekly_targets FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "planner_weekly_targets_admin_update"
  ON public.planner_weekly_targets FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "planner_weekly_targets_admin_delete"
  ON public.planner_weekly_targets FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 8) planner_daily_targets
-- ---------------------------------------------------------------------------
CREATE TABLE public.planner_daily_targets (
  week_id uuid NOT NULL,
  week_day_id uuid NOT NULL,
  player_id uuid NOT NULL,
  td_pct numeric NOT NULL,
  hsr_pct numeric NOT NULL,
  sprint_pct numeric NOT NULL,
  acc_pct numeric NOT NULL,
  dec_pct numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  -- One row per week_day + player; week_id retained for composite FKs.
  PRIMARY KEY (week_day_id, player_id),
  CONSTRAINT planner_daily_targets_weekly_target_fkey
    FOREIGN KEY (week_id, player_id)
    REFERENCES public.planner_weekly_targets (week_id, player_id)
    ON DELETE CASCADE,
  CONSTRAINT planner_daily_targets_week_day_fkey
    FOREIGN KEY (week_day_id, week_id)
    REFERENCES public.planner_week_days (id, week_id)
    ON DELETE CASCADE,
  CONSTRAINT planner_daily_targets_td_pct_check CHECK (td_pct >= 0),
  CONSTRAINT planner_daily_targets_hsr_pct_check CHECK (hsr_pct >= 0),
  CONSTRAINT planner_daily_targets_sprint_pct_check CHECK (sprint_pct >= 0),
  CONSTRAINT planner_daily_targets_acc_pct_check CHECK (acc_pct >= 0),
  CONSTRAINT planner_daily_targets_dec_pct_check CHECK (dec_pct >= 0)
);

CREATE TRIGGER planner_daily_targets_set_updated_at
  BEFORE UPDATE ON public.planner_daily_targets
  FOR EACH ROW
  EXECUTE PROCEDURE public.planner_set_updated_at();

ALTER TABLE public.planner_daily_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_daily_targets_admin_select"
  ON public.planner_daily_targets FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'admin');

CREATE POLICY "planner_daily_targets_admin_insert"
  ON public.planner_daily_targets FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "planner_daily_targets_admin_update"
  ON public.planner_daily_targets FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "planner_daily_targets_admin_delete"
  ON public.planner_daily_targets FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'admin');

-- =============================================================================
-- End GPS Load Planner V1 migration (not applied by this file creation alone)
-- =============================================================================
