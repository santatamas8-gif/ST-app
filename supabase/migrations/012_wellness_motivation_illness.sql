-- Add motivation (1-10) and illness (boolean) to wellness.
ALTER TABLE public.wellness
  ADD COLUMN IF NOT EXISTS motivation smallint CHECK (motivation IS NULL OR (motivation >= 1 AND motivation <= 10));
ALTER TABLE public.wellness
  ADD COLUMN IF NOT EXISTS illness boolean DEFAULT false;
