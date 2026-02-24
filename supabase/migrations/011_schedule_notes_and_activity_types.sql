-- Schedule: add notes (max 100 chars) and extend activity_type with new program types.
ALTER TABLE public.schedule
  ADD COLUMN IF NOT EXISTS notes character varying(100);

-- Extend allowed activity_type values (drop existing check and add new one).
ALTER TABLE public.schedule
  DROP CONSTRAINT IF EXISTS schedule_activity_type_check;

ALTER TABLE public.schedule
  ADD CONSTRAINT schedule_activity_type_check CHECK (activity_type IN (
    'breakfast', 'lunch', 'dinner', 'training', 'gym', 'recovery', 'pre_activation',
    'video_analysis', 'meeting', 'traveling', 'physio', 'medical', 'media',
    'rest_off', 'match', 'team_building', 'individual'
  ));
