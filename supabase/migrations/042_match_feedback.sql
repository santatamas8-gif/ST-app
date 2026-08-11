-- Match Feedback (kiosk + wellness results). Separate from schedule fixtures.
-- Player role: no policies (deny by default). Admin/staff: SELECT. Writes via service-role APIs.

CREATE OR REPLACE FUNCTION public.match_feedback_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.match_feedback_set_updated_at() IS
  'Match Feedback: sets NEW.updated_at = now() on BEFORE UPDATE.';

CREATE TABLE IF NOT EXISTS public.match_feedback_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opponent text NOT NULL,
  match_date date NOT NULL,
  matchday integer NOT NULL CHECK (matchday >= 1),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_feedback_matches_opponent_nonempty CHECK (length(trim(opponent)) > 0)
);

CREATE TABLE IF NOT EXISTS public.match_feedback_participants (
  match_id uuid NOT NULL REFERENCES public.match_feedback_matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS public.match_feedback_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  player_id uuid NOT NULL,
  pre_match_feelings text[] NOT NULL,
  pre_match_other_text text NULL,
  physical_demand smallint NOT NULL CHECK (physical_demand BETWEEN 1 AND 10),
  performance_rating smallint NOT NULL CHECK (performance_rating BETWEEN 1 AND 10),
  physical_dropoff text NOT NULL,
  mental_demand smallint NOT NULL CHECK (mental_demand BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_feedback_responses_unique_player UNIQUE (match_id, player_id),
  CONSTRAINT match_feedback_responses_participant_fk
    FOREIGN KEY (match_id, player_id)
    REFERENCES public.match_feedback_participants(match_id, player_id),
  CONSTRAINT match_feedback_responses_feelings_nonempty
    CHECK (cardinality(pre_match_feelings) >= 1),
  CONSTRAINT match_feedback_responses_feelings_allowed
    CHECK (
      pre_match_feelings <@ ARRAY[
        'Prepared',
        'Fresh',
        'Slight muscle soreness',
        'Heavy legs',
        'Tired',
        'Stressed',
        'Muscle tightness',
        'Pain / discomfort',
        'Low energy',
        'Not fully recovered',
        'Other'
      ]::text[]
    ),
  CONSTRAINT match_feedback_responses_other_text
    CHECK (
      (
        NOT ('Other' = ANY (pre_match_feelings))
        AND pre_match_other_text IS NULL
      )
      OR (
        'Other' = ANY (pre_match_feelings)
        AND pre_match_other_text IS NOT NULL
        AND length(btrim(pre_match_other_text)) > 0
        AND length(pre_match_other_text) <= 200
      )
    ),
  CONSTRAINT match_feedback_responses_dropoff_allowed
    CHECK (
      physical_dropoff IN (
        'No drop-off',
        'First half',
        '45–60 min',
        '60–75 min',
        '75–90+ min'
      )
    )
);

CREATE TRIGGER match_feedback_responses_set_updated_at
  BEFORE UPDATE ON public.match_feedback_responses
  FOR EACH ROW
  EXECUTE PROCEDURE public.match_feedback_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_match_feedback_matches_date
  ON public.match_feedback_matches (match_date DESC);

CREATE INDEX IF NOT EXISTS idx_match_feedback_participants_player
  ON public.match_feedback_participants (player_id);

CREATE INDEX IF NOT EXISTS idx_match_feedback_responses_match
  ON public.match_feedback_responses (match_id);

ALTER TABLE public.match_feedback_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_feedback_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_feedback_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_feedback_matches_select" ON public.match_feedback_matches;
CREATE POLICY "match_feedback_matches_select"
  ON public.match_feedback_matches FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'));

DROP POLICY IF EXISTS "match_feedback_matches_insert" ON public.match_feedback_matches;
CREATE POLICY "match_feedback_matches_insert"
  ON public.match_feedback_matches FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "match_feedback_participants_select" ON public.match_feedback_participants;
CREATE POLICY "match_feedback_participants_select"
  ON public.match_feedback_participants FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'));

DROP POLICY IF EXISTS "match_feedback_participants_insert" ON public.match_feedback_participants;
CREATE POLICY "match_feedback_participants_insert"
  ON public.match_feedback_participants FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "match_feedback_responses_select" ON public.match_feedback_responses;
CREATE POLICY "match_feedback_responses_select"
  ON public.match_feedback_responses FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'));

COMMENT ON TABLE public.match_feedback_matches IS
  'Match Feedback fixtures created by admin for kiosk questionnaires.';
COMMENT ON TABLE public.match_feedback_participants IS
  'Players selected for a Match Feedback match (subset of squad).';
COMMENT ON TABLE public.match_feedback_responses IS
  'One Match Feedback questionnaire response per player per match.';
