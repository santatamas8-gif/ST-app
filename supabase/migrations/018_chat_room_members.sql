-- Who can see which room: chat_room_members. Only members (or admin) see the room and its messages.
CREATE TABLE IF NOT EXISTS public.chat_room_members (
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at timestamptz DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;

-- Members can see who is in the room; admin can see all
CREATE POLICY "chat_room_members_select" ON public.chat_room_members
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.chat_room_members m
      WHERE m.room_id = chat_room_members.room_id AND m.user_id = auth.uid()
    )
  );

-- Only admin can add or remove members
CREATE POLICY "chat_room_members_insert" ON public.chat_room_members
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "chat_room_members_delete" ON public.chat_room_members
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Chat rooms: only visible if user is member or admin
DROP POLICY IF EXISTS "chat_rooms_select" ON public.chat_rooms;
CREATE POLICY "chat_rooms_select" ON public.chat_rooms
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.chat_room_members m
      WHERE m.room_id = chat_rooms.id AND m.user_id = auth.uid()
    )
  );

-- Chat messages: only members (or admin) can read and send
DROP POLICY IF EXISTS "chat_messages_select" ON public.chat_messages;
CREATE POLICY "chat_messages_select" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.chat_room_members m
      WHERE m.room_id = chat_messages.room_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_messages_insert" ON public.chat_messages;
CREATE POLICY "chat_messages_insert" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
      OR EXISTS (
        SELECT 1 FROM public.chat_room_members m
        WHERE m.room_id = chat_messages.room_id AND m.user_id = auth.uid()
      )
    )
  );

-- Backfill: add room creators as members so existing rooms stay visible
INSERT INTO public.chat_room_members (room_id, user_id)
SELECT id, created_by FROM public.chat_rooms
WHERE created_by IS NOT NULL
ON CONFLICT (room_id, user_id) DO NOTHING;
