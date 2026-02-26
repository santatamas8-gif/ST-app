-- Schedule: two teams for match (team_a vs team_b). Keeps opponent for backward compatibility.
ALTER TABLE public.schedule
  ADD COLUMN IF NOT EXISTS team_a character varying(100),
  ADD COLUMN IF NOT EXISTS team_b character varying(100);
