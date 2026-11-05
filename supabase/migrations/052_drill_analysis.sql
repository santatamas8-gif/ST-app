-- Drill Analysis: manual card layout and private drawing storage.
-- Reviewed first-install copy based on the SQL supplied on 2026-11-05.
-- Additions: transaction, first-install prerequisite/collision checks,
-- and explicit privileges on the TWO NEW TABLES only.
-- No Power BI values, existing module data, global grants or old buckets are changed.
-- Existing application code must continue to validate staff access and source keys.
-- Apply the ENTIRE file once; do not apply individual fragments automatically.
-- Keep the repository's 052 migration synchronized with this file.

BEGIN;

DO $da_preflight$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'Missing public.profiles. Stop: this is not the expected ST-AMS database.';
  END IF;

  IF to_regprocedure('public.current_user_role()') IS NULL THEN
    RAISE EXCEPTION 'Missing public.current_user_role(). Stop: check the target database.';
  END IF;

  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE EXCEPTION 'Missing storage.buckets. Stop: Supabase Storage is not available.';
  END IF;

  IF to_regclass('public.drill_analysis_cards') IS NOT NULL
     OR to_regclass('public.drill_analysis_card_sets') IS NOT NULL
     OR to_regclass('public.idx_drill_analysis_cards_session') IS NOT NULL
     OR to_regprocedure('public.drill_analysis_replace_layout(text,text,uuid,jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'Drill Analysis objects already exist. This file is for first installation only; inspect the existing objects before proceeding.';
  END IF;

  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'drill-analysis-images') THEN
    RAISE EXCEPTION 'The drill-analysis-images bucket already exists. Stop and inspect it; this file will not modify an existing bucket.';
  END IF;
END;
$da_preflight$;

CREATE TABLE IF NOT EXISTS public.drill_analysis_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key text NOT NULL,
  session_key text NOT NULL,
  display_name text NOT NULL,
  sort_index integer NOT NULL,
  image_path text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drill_analysis_cards_name_length CHECK (length(display_name) <= 200),
  CONSTRAINT drill_analysis_cards_sort_nonneg CHECK (sort_index >= 0),
  CONSTRAINT drill_analysis_cards_session_key CHECK (split_part(session_key, '.', 1) = 'da1' AND split_part(session_key, '.', 2) = 's'),
  CONSTRAINT drill_analysis_cards_image_path CHECK (
    image_path IS NULL
    OR image_path ~ '^cards/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+$'
  )
);

CREATE TABLE IF NOT EXISTS public.drill_analysis_card_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.drill_analysis_cards(id) ON DELETE CASCADE,
  scope_key text NOT NULL,
  session_key text NOT NULL,
  occurrence_key text NOT NULL,
  sort_index integer NOT NULL,
  CONSTRAINT drill_analysis_sets_sort_nonneg CHECK (sort_index >= 0),
  CONSTRAINT drill_analysis_sets_occurrence CHECK (split_part(occurrence_key, '.', 1) = 'da1' AND split_part(occurrence_key, '.', 2) = 'o'),
  CONSTRAINT drill_analysis_sets_card_occurrence UNIQUE (card_id, occurrence_key),
  CONSTRAINT drill_analysis_sets_card_sort UNIQUE (card_id, sort_index),
  CONSTRAINT drill_analysis_sets_session_occurrence UNIQUE (scope_key, session_key, occurrence_key)
);

CREATE INDEX IF NOT EXISTS idx_drill_analysis_cards_session
  ON public.drill_analysis_cards (scope_key, session_key, sort_index);

ALTER TABLE public.drill_analysis_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drill_analysis_card_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drill_analysis_cards_staff" ON public.drill_analysis_cards;
CREATE POLICY "drill_analysis_cards_staff"
  ON public.drill_analysis_cards
  FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('admin', 'staff'));

DROP POLICY IF EXISTS "drill_analysis_sets_staff" ON public.drill_analysis_card_sets;
CREATE POLICY "drill_analysis_sets_staff"
  ON public.drill_analysis_card_sets
  FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('admin', 'staff'));

-- Permissions apply ONLY to the two new tables.
-- Client accounts can read only; the RLS policies above restrict that to staff/admin.
-- Writes go through the application's staff-checked server routes.
REVOKE ALL ON TABLE public.drill_analysis_cards, public.drill_analysis_card_sets
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.drill_analysis_cards, public.drill_analysis_card_sets
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.drill_analysis_cards, public.drill_analysis_card_sets
  TO service_role;

CREATE OR REPLACE FUNCTION public.drill_analysis_replace_layout(
  p_scope_key text,
  p_session_key text,
  p_user_id uuid,
  p_cards jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card jsonb;
  v_name text;
  v_keys jsonb;
  v_key text;
  v_image text;
  v_card_id uuid;
  v_index integer := 0;
  v_set_index integer;
  v_seen text[] := ARRAY[]::text[];
  v_ids uuid[] := ARRAY[]::uuid[];
  v_id_text text;
  v_result jsonb := '[]'::jsonb;
  v_session_parts text[];
  v_occ_parts text[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(p_scope_key, '') || ':' || coalesce(p_session_key, '')));

  IF p_scope_key IS NULL OR length(trim(p_scope_key)) = 0 THEN
    RAISE EXCEPTION 'scope is required' USING ERRCODE = '22023';
  END IF;

  v_session_parts := string_to_array(coalesce(p_session_key, ''), '.');
  IF array_length(v_session_parts, 1) IS DISTINCT FROM 6
     OR v_session_parts[1] IS DISTINCT FROM 'da1'
     OR v_session_parts[2] IS DISTINCT FROM 's' THEN
    RAISE EXCEPTION 'session key is not valid' USING ERRCODE = '22023';
  END IF;

  IF p_cards IS NULL OR jsonb_typeof(p_cards) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'cards must be an array' USING ERRCODE = '22023';
  END IF;

  FOR v_card IN SELECT value FROM jsonb_array_elements(p_cards)
  LOOP
    v_name := trim(coalesce(v_card->>'displayName', ''));
    IF length(v_name) > 200 THEN
      RAISE EXCEPTION 'a display name must be 200 characters or fewer' USING ERRCODE = '22023';
    END IF;
    v_id_text := NULLIF(v_card->>'id', '');
    IF v_id_text IS NOT NULL THEN
      IF v_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'card id is not valid' USING ERRCODE = '22023';
      END IF;
      v_card_id := v_id_text::uuid;
      IF v_card_id = ANY (v_ids) THEN
        RAISE EXCEPTION 'duplicate card' USING ERRCODE = '23505';
      END IF;
      v_ids := array_append(v_ids, v_card_id);
    END IF;
    v_keys := v_card->'occurrenceKeys';
    IF v_keys IS NULL OR jsonb_typeof(v_keys) IS DISTINCT FROM 'array' OR jsonb_array_length(v_keys) = 0 THEN
      RAISE EXCEPTION 'each card needs at least one occurrence' USING ERRCODE = '22023';
    END IF;
    v_image := NULLIF(v_card->>'imagePath', '');
    IF v_image IS NOT NULL AND v_image !~ '^cards/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+$' THEN
      RAISE EXCEPTION 'image path is not valid' USING ERRCODE = '22023';
    END IF;
    FOR v_key IN SELECT jsonb_array_elements_text(v_keys)
    LOOP
      IF v_key = ANY (v_seen) THEN
        RAISE EXCEPTION 'duplicate occurrence' USING ERRCODE = '23505';
      END IF;
      v_seen := array_append(v_seen, v_key);
      v_occ_parts := string_to_array(v_key, '.');
      IF array_length(v_occ_parts, 1) IS DISTINCT FROM 8
         OR v_occ_parts[1] IS DISTINCT FROM 'da1'
         OR v_occ_parts[2] IS DISTINCT FROM 'o'
         OR v_occ_parts[3] IS DISTINCT FROM v_session_parts[3]
         OR v_occ_parts[4] IS DISTINCT FROM v_session_parts[4]
         OR v_occ_parts[5] IS DISTINCT FROM v_session_parts[5]
         OR v_occ_parts[6] IS DISTINCT FROM v_session_parts[6] THEN
        RAISE EXCEPTION 'occurrence is not in this session' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END LOOP;

  DELETE FROM public.drill_analysis_cards
  WHERE scope_key = p_scope_key
    AND session_key = p_session_key;

  FOR v_card IN SELECT value FROM jsonb_array_elements(p_cards)
  LOOP
    v_id_text := NULLIF(v_card->>'id', '');
    v_card_id := CASE WHEN v_id_text IS NULL THEN gen_random_uuid() ELSE v_id_text::uuid END;
    v_name := trim(coalesce(v_card->>'displayName', ''));
    v_image := NULLIF(v_card->>'imagePath', '');
    INSERT INTO public.drill_analysis_cards (
      id, scope_key, session_key, display_name, sort_index, image_path, created_by, updated_by
    ) VALUES (
      v_card_id, p_scope_key, p_session_key, v_name, v_index, v_image, p_user_id, p_user_id
    );
    v_set_index := 0;
    FOR v_key IN SELECT jsonb_array_elements_text(v_card->'occurrenceKeys')
    LOOP
      INSERT INTO public.drill_analysis_card_sets (
        card_id, scope_key, session_key, occurrence_key, sort_index
      ) VALUES (
        v_card_id, p_scope_key, p_session_key, v_key, v_set_index
      );
      v_set_index := v_set_index + 1;
    END LOOP;
    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'id', v_card_id,
        'imagePath', v_image,
        'occurrenceKeys', v_card->'occurrenceKeys'
      )
    );
    v_index := v_index + 1;
  END LOOP;

  RETURN jsonb_build_object('cards', v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.drill_analysis_replace_layout(text, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.drill_analysis_replace_layout(text, text, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.drill_analysis_replace_layout(text, text, uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.drill_analysis_replace_layout(text, text, uuid, jsonb) TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'drill-analysis-images',
  'drill-analysis-images',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
