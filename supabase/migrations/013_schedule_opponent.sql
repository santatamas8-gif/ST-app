-- Schedule: opponent for match only (nullable, max 100 chars).
ALTER TABLE public.schedule
  ADD COLUMN IF NOT EXISTS opponent character varying(100);
