-- =============================================================================
-- GPS Load Planner — privilege hardening for atomic snapshot+target RPC
-- =============================================================================
-- LOCAL ONLY until Lead + Database + QA approve apply.
--
-- Privilege-only reconciliation for:
--   public.planner_create_snapshot_and_weekly_target(
--     uuid, uuid, text,
--     numeric, numeric, numeric, numeric, numeric,
--     numeric, numeric, numeric, numeric, numeric
--   )
--
-- Does NOT recreate or replace the function body from migration 040.
-- Does NOT alter planner table schema, RLS, triggers, or constraints.
--
-- Required final EXECUTE:
--   PUBLIC          NO
--   anon            NO
--   authenticated   YES
--   service_role    NO
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.planner_create_snapshot_and_weekly_target(
  uuid, uuid, text,
  numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric
) FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.planner_create_snapshot_and_weekly_target(
  uuid, uuid, text,
  numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric
) TO authenticated;

-- =============================================================================
-- End privilege hardening (not applied by this file creation alone)
-- =============================================================================
