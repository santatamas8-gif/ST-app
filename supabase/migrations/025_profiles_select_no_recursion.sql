-- Fix infinite recursion: profiles policy must not read from profiles.
-- Use SECURITY DEFINER helper so role check does not trigger RLS on profiles.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.current_user_role() IN ('admin', 'staff')
  OR EXISTS (
    SELECT 1 FROM public.chat_room_members m1
    JOIN public.chat_room_members m2 ON m1.room_id = m2.room_id AND m2.user_id = public.profiles.id
    WHERE m1.user_id = auth.uid()
  )
);
