-- Players need read access to session metadata and exercise images for published cards.

CREATE POLICY "daily_strength_sessions_player_select"
  ON public.daily_strength_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_strength_player_cards c
      WHERE c.session_id = id
        AND c.player_id = auth.uid()
        AND c.status = 'published'
    )
  );

CREATE POLICY "strength_exercises_player_select_active"
  ON public.strength_exercises FOR SELECT
  USING (active = true);
