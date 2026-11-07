-- Drill History notes written by staff.
-- One shared note per history drill. Does not change cards, images, Power BI, or migration 052.
-- Apply this entire file once in the Supabase SQL editor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.drill_analysis_history_notes (
  scope_key text NOT NULL,
  session_key text NOT NULL,
  entry_id text NOT NULL,
  note text NOT NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_key, session_key, entry_id),
  CONSTRAINT drill_analysis_history_notes_session_key CHECK (
    split_part(session_key, '.', 1) = 'da1' AND split_part(session_key, '.', 2) = 's'
  ),
  CONSTRAINT drill_analysis_history_notes_entry_id CHECK (
    char_length(entry_id) <= 800
    AND (
      entry_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR (
        left(entry_id, 10) = 'ungrouped:'
        AND split_part(substr(entry_id, 11), '.', 1) = 'da1'
        AND split_part(substr(entry_id, 11), '.', 2) = 'o'
      )
    )
  ),
  CONSTRAINT drill_analysis_history_notes_length CHECK (char_length(note) BETWEEN 1 AND 2000)
);

ALTER TABLE public.drill_analysis_history_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drill_analysis_history_notes_staff" ON public.drill_analysis_history_notes;
CREATE POLICY "drill_analysis_history_notes_staff"
  ON public.drill_analysis_history_notes
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'));

REVOKE ALL ON TABLE public.drill_analysis_history_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.drill_analysis_history_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.drill_analysis_history_notes TO service_role;

COMMIT;
