-- When user last read each room (for unread badge)
CREATE TABLE IF NOT EXISTS public.chat_room_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, room_id)
);

ALTER TABLE public.chat_room_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_room_reads_select_own" ON public.chat_room_reads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "chat_room_reads_insert_own" ON public.chat_room_reads
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chat_room_reads_update_own" ON public.chat_room_reads
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
