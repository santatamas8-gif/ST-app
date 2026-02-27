-- Fix infinite recursion: policies must not read chat_room_members inside
-- chat_room_members policy. Use a SECURITY DEFINER function that bypasses RLS.
CREATE OR REPLACE FUNCTION public.is_chat_room_member(p_room_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_room_members m
    WHERE m.room_id = p_room_id AND m.user_id = p_user_id
  );
$$;

-- Recreate chat_room_members SELECT using the function (no self-read)
DROP POLICY IF EXISTS "chat_room_members_select" ON public.chat_room_members;
CREATE POLICY "chat_room_members_select" ON public.chat_room_members
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR public.is_chat_room_member(chat_room_members.room_id, auth.uid())
  );

-- Chat rooms: use function instead of EXISTS on chat_room_members
DROP POLICY IF EXISTS "chat_rooms_select" ON public.chat_rooms;
CREATE POLICY "chat_rooms_select" ON public.chat_rooms
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR public.is_chat_room_member(chat_rooms.id, auth.uid())
  );

-- Chat messages: use function
DROP POLICY IF EXISTS "chat_messages_select" ON public.chat_messages;
CREATE POLICY "chat_messages_select" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR public.is_chat_room_member(chat_messages.room_id, auth.uid())
  );

DROP POLICY IF EXISTS "chat_messages_insert" ON public.chat_messages;
CREATE POLICY "chat_messages_insert" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
      OR public.is_chat_room_member(chat_messages.room_id, auth.uid())
    )
  );
