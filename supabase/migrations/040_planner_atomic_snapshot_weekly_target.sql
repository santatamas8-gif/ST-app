-- =============================================================================
-- GPS Load Planner Phase B — atomic first snapshot + weekly target create
-- =============================================================================
-- LOCAL ONLY until Lead + Database + QA approve apply.
-- Does NOT alter planner table schema or existing RLS policies.
--
-- Purpose:
--   When a player has NO frozen Match Best snapshot for a planner week, the
--   first Weekly Target creation must insert BOTH:
--     1) planner_match_best_snapshots
--     2) planner_weekly_targets
--   in ONE PostgreSQL transaction so a failed target insert cannot leave an
--   orphan snapshot.
--
-- Call path (future domain, after apply):
--   supabase.rpc('planner_create_snapshot_and_weekly_target', {...})
--
-- NOT for:
--   - recreating a Weekly Target when a snapshot already exists
--   - updating snapshots (immutable)
--   - Daily Targets / Actuals
-- =============================================================================

CREATE OR REPLACE FUNCTION public.planner_create_snapshot_and_weekly_target(
  p_week_id uuid,
  p_player_id uuid,
  p_powerbi_player_name text,
  p_td_best numeric,
  p_hsr_best numeric,
  p_sprint_best numeric,
  p_acc_best numeric,
  p_dec_best numeric,
  p_td_pct numeric,
  p_hsr_pct numeric,
  p_sprint_pct numeric,
  p_acc_pct numeric,
  p_dec_pct numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_snapshot public.planner_match_best_snapshots%ROWTYPE;
  v_target public.planner_weekly_targets%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'planner_create_snapshot_and_weekly_target: authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'planner_create_snapshot_and_weekly_target: admin access required'
      USING ERRCODE = '42501';
  END IF;

  IF p_week_id IS NULL OR p_player_id IS NULL THEN
    RAISE EXCEPTION 'planner_create_snapshot_and_weekly_target: week_id and player_id are required'
      USING ERRCODE = '22023';
  END IF;

  -- Emptiness check only; store the exact provided Power BI identity (no case/space rewrite).
  IF p_powerbi_player_name IS NULL OR length(btrim(p_powerbi_player_name)) = 0 THEN
    RAISE EXCEPTION 'planner_create_snapshot_and_weekly_target: powerbi_player_name is required'
      USING ERRCODE = '22023';
  END IF;

  -- Canonical player must exist in profiles with role = player (not auth.users alone).
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_player_id
      AND p.role = 'player'
  ) THEN
    RAISE EXCEPTION 'planner_create_snapshot_and_weekly_target: player_id must refer to a profiles row with role = player'
      USING ERRCODE = '22023';
  END IF;

  -- Exact Power BI mapping required before any write (no lower/trim/normalize/fuzzy).
  IF NOT EXISTS (
    SELECT 1
    FROM public.player_external_mappings m
    WHERE m.player_id = p_player_id
      AND m.provider = 'powerbi'
      AND m.external_player_name = p_powerbi_player_name
  ) THEN
    RAISE EXCEPTION 'planner_create_snapshot_and_weekly_target: no exact powerbi mapping for player_id and powerbi_player_name'
      USING ERRCODE = '22023';
  END IF;

  -- Reject incomplete / invalid Match Best before any write.
  IF p_td_best IS NULL OR p_hsr_best IS NULL OR p_sprint_best IS NULL
     OR p_acc_best IS NULL OR p_dec_best IS NULL THEN
    RAISE EXCEPTION 'planner_create_snapshot_and_weekly_target: match best values must all be non-null'
      USING ERRCODE = '22023';
  END IF;

  IF p_td_best < 0 OR p_hsr_best < 0 OR p_sprint_best < 0
     OR p_acc_best < 0 OR p_dec_best < 0 THEN
    RAISE EXCEPTION 'planner_create_snapshot_and_weekly_target: match best values must be >= 0'
      USING ERRCODE = '22023';
  END IF;

  IF p_td_pct IS NULL OR p_hsr_pct IS NULL OR p_sprint_pct IS NULL
     OR p_acc_pct IS NULL OR p_dec_pct IS NULL THEN
    RAISE EXCEPTION 'planner_create_snapshot_and_weekly_target: weekly percentages must all be non-null'
      USING ERRCODE = '22023';
  END IF;

  IF p_td_pct < 0 OR p_hsr_pct < 0 OR p_sprint_pct < 0
     OR p_acc_pct < 0 OR p_dec_pct < 0 THEN
    RAISE EXCEPTION 'planner_create_snapshot_and_weekly_target: weekly percentages must be >= 0'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.planner_match_best_snapshots (
    week_id,
    player_id,
    td_best,
    hsr_best,
    sprint_best,
    acc_best,
    dec_best,
    powerbi_player_name,
    source_method,
    created_by
  )
  VALUES (
    p_week_id,
    p_player_id,
    p_td_best,
    p_hsr_best,
    p_sprint_best,
    p_acc_best,
    p_dec_best,
    p_powerbi_player_name,
    'single-match best',
    v_uid
  )
  RETURNING * INTO v_snapshot;

  INSERT INTO public.planner_weekly_targets (
    week_id,
    player_id,
    td_pct,
    hsr_pct,
    sprint_pct,
    acc_pct,
    dec_pct,
    created_by,
    updated_by
  )
  VALUES (
    p_week_id,
    p_player_id,
    p_td_pct,
    p_hsr_pct,
    p_sprint_pct,
    p_acc_pct,
    p_dec_pct,
    v_uid,
    v_uid
  )
  RETURNING * INTO v_target;

  RETURN jsonb_build_object(
    'snapshot', to_jsonb(v_snapshot),
    'weekly_target', to_jsonb(v_target)
  );

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION
      'planner_create_snapshot_and_weekly_target: snapshot or weekly target already exists for this week/player'
      USING ERRCODE = '23505';
  WHEN foreign_key_violation THEN
    RAISE EXCEPTION
      'planner_create_snapshot_and_weekly_target: week_id or player_id is invalid (foreign key)'
      USING ERRCODE = '23503';
END;
$$;

COMMENT ON FUNCTION public.planner_create_snapshot_and_weekly_target(
  uuid, uuid, text, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric
) IS
  'ADMIN-only SECURITY INVOKER: atomically insert frozen Match Best snapshot + Weekly Target for one week/player. source_method is fixed to single-match best. Use only when no snapshot exists yet.';

REVOKE ALL ON FUNCTION public.planner_create_snapshot_and_weekly_target(
  uuid, uuid, text, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.planner_create_snapshot_and_weekly_target(
  uuid, uuid, text, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric
) TO authenticated;

-- =============================================================================
-- End Phase B atomic create function (not applied by this file creation alone)
-- =============================================================================
