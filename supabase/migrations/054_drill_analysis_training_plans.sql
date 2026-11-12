-- Training Planner: saved plans built from Drill History cards.
-- Stores a server-built snapshot and an optional private image copy.
-- Does not change cards, history notes, Power BI, or migration 052.
-- Apply this entire file once in the Supabase SQL editor. Do not run it automatically.

BEGIN;

CREATE TABLE IF NOT EXISTS public.drill_analysis_training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key text NOT NULL,
  name text NOT NULL,
  plan_date date NOT NULL,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drill_analysis_training_plans_scope CHECK (scope_key = 'gps_log'),
  CONSTRAINT drill_analysis_training_plans_name CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT drill_analysis_training_plans_notes CHECK (notes IS NULL OR char_length(notes) BETWEEN 1 AND 2000)
);

CREATE TABLE IF NOT EXISTS public.drill_analysis_training_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.drill_analysis_training_plans(id) ON DELETE CASCADE,
  scope_key text NOT NULL,
  sort_index integer NOT NULL,
  source_session_key text NOT NULL,
  source_entry_id text NOT NULL,
  snapshot jsonb NOT NULL,
  image_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drill_analysis_training_plan_items_scope CHECK (scope_key = 'gps_log'),
  CONSTRAINT drill_analysis_training_plan_items_sort CHECK (sort_index >= 0),
  CONSTRAINT drill_analysis_training_plan_items_session CHECK (
    split_part(source_session_key, '.', 1) = 'da1' AND split_part(source_session_key, '.', 2) = 's'
  ),
  CONSTRAINT drill_analysis_training_plan_items_entry CHECK (
    char_length(source_entry_id) <= 800
    AND (
      source_entry_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR (
        left(source_entry_id, 10) = 'ungrouped:'
        AND split_part(substr(source_entry_id, 11), '.', 1) = 'da1'
        AND split_part(substr(source_entry_id, 11), '.', 2) = 'o'
      )
    )
  ),
  CONSTRAINT drill_analysis_training_plan_items_snapshot CHECK (jsonb_typeof(snapshot) = 'object'),
  CONSTRAINT drill_analysis_training_plan_items_image CHECK (
    image_path IS NULL
    OR image_path ~* '^plans/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  ),
  CONSTRAINT drill_analysis_training_plan_items_source UNIQUE (plan_id, source_session_key, source_entry_id),
  CONSTRAINT drill_analysis_training_plan_items_order UNIQUE (plan_id, sort_index)
);

CREATE INDEX IF NOT EXISTS idx_drill_analysis_training_plans_updated
  ON public.drill_analysis_training_plans (scope_key, updated_at DESC);

ALTER TABLE public.drill_analysis_training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drill_analysis_training_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drill_analysis_training_plans_staff" ON public.drill_analysis_training_plans;
CREATE POLICY "drill_analysis_training_plans_staff"
  ON public.drill_analysis_training_plans
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'));

DROP POLICY IF EXISTS "drill_analysis_training_plan_items_staff" ON public.drill_analysis_training_plan_items;
CREATE POLICY "drill_analysis_training_plan_items_staff"
  ON public.drill_analysis_training_plan_items
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'));

REVOKE ALL ON TABLE public.drill_analysis_training_plans, public.drill_analysis_training_plan_items
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.drill_analysis_training_plans, public.drill_analysis_training_plan_items
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.drill_analysis_training_plans, public.drill_analysis_training_plan_items
  TO service_role;

COMMIT;
