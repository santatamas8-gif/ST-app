-- Kiosk RPE: allow additional post-match matchday tags.

ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_matchday_tag_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_matchday_tag_check
  CHECK (
    matchday_tag IS NULL
    OR matchday_tag IN (
      'MD',
      'MD+1',
      'MD+2',
      'MD+3',
      'MD+4',
      'MD-4',
      'MD-3',
      'MD-2',
      'MD-1'
    )
  );
