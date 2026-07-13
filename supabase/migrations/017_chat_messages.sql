-- Chat messages: anyone authenticated can read (rooms are visible to all) and send.
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  attachment_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_room_id_created_at
  ON public.chat_messages(room_id, created_at DESC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated (same as chat_rooms visibility)
CREATE POLICY "chat_messages_select" ON public.chat_messages
  FOR SELECT TO authenticated USING (true);

-- Insert: authenticated users can send in any room
CREATE POLICY "chat_messages_insert" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Optional: users can delete their own messages (soft or hard)
CREATE POLICY "chat_messages_delete_own" ON public.chat_messages
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Enable Realtime so clients can subscribe to new messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
