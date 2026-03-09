-- Add 'arrival' to schedule activity_type (desktop + mobile calendar).
ALTER TABLE public.schedule
  DROP CONSTRAINT IF EXISTS schedule_activity_type_check;

ALTER TABLE public.schedule
  ADD CONSTRAINT schedule_activity_type_check CHECK (activity_type IN (
    'arrival',
    'breakfast', 'lunch', 'dinner', 'training', 'gym', 'recovery', 'pre_activation',
    'video_analysis', 'meeting', 'traveling', 'physio', 'medical', 'media',
    'rest_off', 'match', 'team_building', 'individual'
  ));
