-- Add body_parts JSONB to wellness for per-part soreness and pain (1-10).
-- Structure: { "part_id": { "s": number, "p": number } } where s = soreness, p = pain.
ALTER TABLE public.wellness
  ADD COLUMN IF NOT EXISTS body_parts jsonb DEFAULT NULL;
