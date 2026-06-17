-- Kiosk RPE: optional session metadata on existing sessions rows.
-- Nullable so legacy player self-submitted sessions remain valid.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS session_type text,
  ADD COLUMN IF NOT EXISTS matchday_tag text;

ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_session_type_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_session_type_check
  CHECK (
    session_type IS NULL
    OR session_type IN (
      'Pitch',
      'Gym',
      'Recovery',
      'Rehab',
      'Individual',
      'Match',
      'Goalkeeper',
      'Extra'
    )
  );

ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_matchday_tag_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_matchday_tag_check
  CHECK (
    matchday_tag IS NULL
    OR matchday_tag IN (
      'MD',
      'MD+1',
      'MD-4',
      'MD-3',
      'MD-2',
      'MD-1'
    )
  );
