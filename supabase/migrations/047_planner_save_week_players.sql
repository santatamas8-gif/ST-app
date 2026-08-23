-- =============================================================================
-- GPS Load Planner — Persistent Week Squad atomic Save RPC
-- =============================================================================
-- DO NOT apply this migration automatically.
-- Apply only after Lead + gps-planner-database + gps-planner-qa review,
-- via explicit Supabase SQL run / controlled migrate step.
-- Do not push or run against live DB from agents.
--
-- Authority: docs/GPS_LOAD_PLANNER_MASTER_SPEC.md §J2
-- Purpose: one Admin Save Squad = one atomic membership replacement.
--
-- SECURITY INVOKER. Caller remains the authenticated Admin.
-- RLS on planner_week_players / planner_weeks stays authoritative.
--
-- Mutates ONLY public.planner_week_players.
-- Does NOT write Weekly/Daily Targets, snapshots, Groups, or week metadata.
--
-- Same-week concurrency: SELECT planner_weeks FOR UPDATE serializes Saves
-- for one week. Each transaction then reads membership and writes a complete
-- desired set. Final DB state is one complete requested squad, never a mix.
--
-- EXECUTE: authenticated only. PUBLIC / anon / service_role revoked.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.planner_save_week_players(
  p_week_id uuid,
  p_player_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_week_id uuid;
  v_desired uuid[];
  v_saved uuid[];
  v_added uuid[];
  v_removed uuid[];
  v_invalid_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'planner_save_week_players: authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'planner_save_week_players: admin access required'
      USING ERRCODE = '42501';
  END IF;

  IF p_week_id IS NULL THEN
    RAISE EXCEPTION 'planner_save_week_players: week_id is required'
      USING ERRCODE = '22023';
  END IF;

  -- NULL array is invalid. Empty array '{}' is a valid explicit empty squad.
  IF p_player_ids IS NULL THEN
    RAISE EXCEPTION 'planner_save_week_players: player_ids must not be null'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_player_ids) AS pid
    WHERE pid IS NULL
  ) THEN
    RAISE EXCEPTION 'planner_save_week_players: player_ids must not contain null'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT pid ORDER BY pid), ARRAY[]::uuid[])
  INTO v_desired
  FROM unnest(p_player_ids) AS pid;

  -- Lock the exact week row for this transaction. Requires Admin SELECT +
  -- table UPDATE privilege (existing planner_weeks Admin UPDATE policy/grants).
  -- The week row is not updated.
  SELECT w.id
  INTO v_week_id
  FROM public.planner_weeks w
  WHERE w.id = p_week_id
  FOR UPDATE OF w;

  IF v_week_id IS NULL THEN
    RAISE EXCEPTION 'planner_save_week_players: planner week was not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF cardinality(v_desired) > 0 THEN
    SELECT COUNT(*)
    INTO v_invalid_count
    FROM unnest(v_desired) AS d(pid)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = d.pid
        AND p.role = 'player'
    );

    IF v_invalid_count > 0 THEN
      RAISE EXCEPTION
        'planner_save_week_players: every player_id must refer to a profiles row with role = player'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT COALESCE(array_agg(m.player_id ORDER BY m.player_id), ARRAY[]::uuid[])
  INTO v_removed
  FROM public.planner_week_players m
  WHERE m.week_id = p_week_id
    AND NOT (m.player_id = ANY (v_desired));

  SELECT COALESCE(array_agg(d.pid ORDER BY d.pid), ARRAY[]::uuid[])
  INTO v_added
  FROM unnest(v_desired) AS d(pid)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.planner_week_players m
    WHERE m.week_id = p_week_id
      AND m.player_id = d.pid
  );

  v_added := COALESCE(v_added, ARRAY[]::uuid[]);
  v_removed := COALESCE(v_removed, ARRAY[]::uuid[]);

  IF cardinality(v_added) = 0 AND cardinality(v_removed) = 0 THEN
    SELECT COALESCE(array_agg(m.player_id ORDER BY m.player_id), ARRAY[]::uuid[])
    INTO v_saved
    FROM public.planner_week_players m
    WHERE m.week_id = p_week_id;

    RETURN jsonb_build_object(
      'savedPlayerIds', COALESCE(to_jsonb(v_saved), '[]'::jsonb),
      'addedPlayerIds', '[]'::jsonb,
      'removedPlayerIds', '[]'::jsonb,
      'changed', false
    );
  END IF;

  IF cardinality(v_removed) > 0 THEN
    DELETE FROM public.planner_week_players m
    WHERE m.week_id = p_week_id
      AND m.player_id = ANY (v_removed);
  END IF;

  IF cardinality(v_added) > 0 THEN
    INSERT INTO public.planner_week_players (week_id, player_id, created_by)
    SELECT p_week_id, a.pid, v_uid
    FROM unnest(v_added) AS a(pid);
  END IF;

  SELECT COALESCE(array_agg(m.player_id ORDER BY m.player_id), ARRAY[]::uuid[])
  INTO v_saved
  FROM public.planner_week_players m
  WHERE m.week_id = p_week_id;

  RETURN jsonb_build_object(
    'savedPlayerIds', COALESCE(to_jsonb(v_saved), '[]'::jsonb),
    'addedPlayerIds', COALESCE(to_jsonb(v_added), '[]'::jsonb),
    'removedPlayerIds', COALESCE(to_jsonb(v_removed), '[]'::jsonb),
    'changed', true
  );
END;
$$;

COMMENT ON FUNCTION public.planner_save_week_players(uuid, uuid[]) IS
  'ADMIN-only SECURITY INVOKER: atomically replace planner_week_players for one week. NULL player_ids is rejected; empty array clears membership only. Does not write targets, snapshots, or groups.';

REVOKE ALL ON FUNCTION public.planner_save_week_players(uuid, uuid[])
  FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.planner_save_week_players(uuid, uuid[])
  TO authenticated;

-- =============================================================================
-- End Persistent Week Squad atomic Save RPC (not applied by this file creation)
-- =============================================================================
