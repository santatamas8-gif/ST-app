-- Allow unauthenticated (anon) read of team_settings so login page can show team logo.
-- Only team_name and team_logo_url are exposed (public branding).
CREATE POLICY "team_settings_select_anon" ON public.team_settings
  FOR SELECT TO anon USING (true);
