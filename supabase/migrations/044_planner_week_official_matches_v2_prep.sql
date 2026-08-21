-- =============================================================================
-- GPS Load Planner — Two-Match Week V2 Phase A: official-match table prep
-- =============================================================================
-- DO NOT apply this migration automatically.
-- Apply only after Lead + gps-planner-database + gps-planner-qa review,
-- via explicit Supabase SQL run / controlled migrate step.
-- Do not push or run against live DB from agents.
--
-- Purpose: backward-compatible schema preparation for future 0–2 Match rows.
-- Phase A MUST still enforce maximum ONE Match row per week.
--
-- DO NOT:
--   drop UNIQUE (week_id)
--   enable a second Match row
--   store GPS Actuals
--   put Match dates into planner_week_days
--   change Admin-only RLS
--   add a CHECK that gps_date is inside planner_weeks.start_date..end_date
--
-- Existing W5 row must be preserved in place (same id, week_id, gps_date,
-- opponent, matchday, competition). Only backfill:
--   match_order = 1
--   md_tag = 'MD'
--
-- Defaults on new columns keep current V1 INSERT (no match_order / md_tag)
-- working until Phase B plural APIs exist.
-- =============================================================================

-- 1–4) match_order: add, backfill existing rows to 1, NOT NULL, CHECK IN (1, 2)
ALTER TABLE public.planner_week_official_matches
  ADD COLUMN match_order smallint NOT NULL DEFAULT 1;

ALTER TABLE public.planner_week_official_matches
  ADD CONSTRAINT planner_week_official_matches_match_order_check
    CHECK (match_order IN (1, 2));

COMMENT ON COLUMN public.planner_week_official_matches.match_order IS
  'Stable Match slot for the planner week: 1 or 2. Phase A still allows only one row per week via UNIQUE (week_id).';

-- 5–7) md_tag: add, backfill existing rows to MD, trim/non-empty, NOT NULL
-- Distinct from matchday (e.g. md_tag = MD, matchday = Matchday 5).
ALTER TABLE public.planner_week_official_matches
  ADD COLUMN md_tag text NOT NULL DEFAULT 'MD';

ALTER TABLE public.planner_week_official_matches
  ADD CONSTRAINT planner_week_official_matches_md_tag_trim_check
    CHECK (length(trim(md_tag)) > 0);

COMMENT ON COLUMN public.planner_week_official_matches.md_tag IS
  'Admin-entered Match display/context tag (typically MD). Not unique. Not a Power BI MD1/MD2. Distinct from matchday.';

-- 8–9) opponent / matchday optional for future Create Week (date + md_tag only).
-- PostgreSQL CHECK already treats NULL as passing; make the rule explicit.
-- Existing W5 non-null metadata is not rewritten.
ALTER TABLE public.planner_week_official_matches
  ALTER COLUMN opponent DROP NOT NULL;

ALTER TABLE public.planner_week_official_matches
  DROP CONSTRAINT planner_week_official_matches_opponent_trim_check;

ALTER TABLE public.planner_week_official_matches
  ADD CONSTRAINT planner_week_official_matches_opponent_trim_check
    CHECK (opponent IS NULL OR length(trim(opponent)) > 0);

ALTER TABLE public.planner_week_official_matches
  ALTER COLUMN matchday DROP NOT NULL;

ALTER TABLE public.planner_week_official_matches
  DROP CONSTRAINT planner_week_official_matches_matchday_trim_check;

ALTER TABLE public.planner_week_official_matches
  ADD CONSTRAINT planner_week_official_matches_matchday_trim_check
    CHECK (matchday IS NULL OR length(trim(matchday)) > 0);

-- competition remains nullable with non-empty-if-present CHECK (unchanged).

-- 10) Future uniqueness (week, slot). UNIQUE (week_id) still blocks a second row.
ALTER TABLE public.planner_week_official_matches
  ADD CONSTRAINT planner_week_official_matches_week_id_match_order_key
    UNIQUE (week_id, match_order);

-- 11) Future uniqueness (week, GPS date). No date-range CHECK.
ALTER TABLE public.planner_week_official_matches
  ADD CONSTRAINT planner_week_official_matches_week_id_gps_date_key
    UNIQUE (week_id, gps_date);

-- 12) KEEP planner_week_official_matches_week_id_key UNIQUE (week_id).
-- Do not drop it in Phase A. Current .maybeSingle() runtime depends on it.

COMMENT ON TABLE public.planner_week_official_matches IS
  'ADMIN-ONLY Match identity/display for Total Load. Phase A: still one row per week (UNIQUE week_id). Prepared for later 0–2 rows (match_order, md_tag). gps_date may fall outside planner_weeks.start_date..end_date. No GPS Actual columns.';

-- =============================================================================
-- End Phase A official-match prep (not applied by this file creation alone)
-- =============================================================================
