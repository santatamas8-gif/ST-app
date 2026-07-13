-- Team/club settings: name and logo URL (single row, admin can update).
CREATE TABLE IF NOT EXISTS public.team_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name text,
  team_logo_url text,
  updated_at timestamptz DEFAULT now()
);

-- Ensure single row: insert if empty.
INSERT INTO public.team_settings (team_name, team_logo_url)
SELECT NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.team_settings LIMIT 1);

ALTER TABLE public.team_settings ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "team_settings_select" ON public.team_settings
  FOR SELECT TO authenticated USING (true);

-- Only admin can update
CREATE POLICY "team_settings_update" ON public.team_settings
  FOR UPDATE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
