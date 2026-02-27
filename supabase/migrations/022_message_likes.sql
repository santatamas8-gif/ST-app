-- One like per user per message (simple like, no multiple emojis)
CREATE TABLE IF NOT EXISTS public.message_likes (
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE public.message_likes ENABLE ROW LEVEL SECURITY;

-- Read: members of the room can see likes (use same pattern as messages - is_chat_room_member)
CREATE POLICY "message_likes_select" ON public.message_likes
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR public.is_chat_room_member(
      (SELECT room_id FROM public.chat_messages WHERE id = message_likes.message_id),
      auth.uid()
    )
  );

CREATE POLICY "message_likes_insert" ON public.message_likes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "message_likes_delete_own" ON public.message_likes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
