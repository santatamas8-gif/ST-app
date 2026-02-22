-- Schedule item start/end time (optional for existing rows).
ALTER TABLE public.schedule
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;
