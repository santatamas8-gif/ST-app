-- Staff/admin can read team wellness, sessions, and profiles (required for dashboard, wellness, RPE).
-- Idempotent: safe to run on DBs that already applied add-admin-staff-policies.sql manually.

-- Role helper: app uses profiles (not legacy public.users).
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Ensure profiles.email exists for user list UIs.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';

-- Sync email on signup (idempotent replace).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, email)
  VALUES (NEW.id, 'player', COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(EXCLUDED.email, profiles.email);
  RETURN NEW;
END;
$$;

-- --- profiles ---
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.current_user_role() IN ('admin', 'staff')
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR public.current_user_role() = 'admin'
  )
  WITH CHECK (
    id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
CREATE POLICY "profiles_insert_admin"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

-- --- wellness ---
DROP POLICY IF EXISTS "wellness_select_own" ON public.wellness;
DROP POLICY IF EXISTS "wellness_select" ON public.wellness;
CREATE POLICY "wellness_select"
  ON public.wellness FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.current_user_role() IN ('admin', 'staff')
  );

-- --- sessions ---
DROP POLICY IF EXISTS "sessions_select_own" ON public.sessions;
DROP POLICY IF EXISTS "sessions_select" ON public.sessions;
CREATE POLICY "sessions_select"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.current_user_role() IN ('admin', 'staff')
  );

-- --- strength player read (idempotent; same as 034) ---
DROP POLICY IF EXISTS "daily_strength_sessions_player_select" ON public.daily_strength_sessions;
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

DROP POLICY IF EXISTS "strength_exercises_player_select_active" ON public.strength_exercises;
CREATE POLICY "strength_exercises_player_select_active"
  ON public.strength_exercises FOR SELECT
  USING (active = true);
