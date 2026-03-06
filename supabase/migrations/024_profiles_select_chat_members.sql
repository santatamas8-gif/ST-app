-- Allow users to read display info (id, full_name, email) of other users who share a chat room,
-- so chat can show "Santa Tamas" instead of user_id for message senders.
-- Keeps: own profile always; admin/staff see all; players see profiles of users in same room(s).

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
  OR EXISTS (
    SELECT 1 FROM public.chat_room_members m1
    JOIN public.chat_room_members m2 ON m1.room_id = m2.room_id AND m2.user_id = public.profiles.id
    WHERE m1.user_id = auth.uid()
  )
);
