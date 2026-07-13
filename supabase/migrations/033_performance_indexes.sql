-- Performance indexes for common dashboard, chat, and staff queries.

CREATE INDEX IF NOT EXISTS idx_wellness_date ON public.wellness(date);
CREATE INDEX IF NOT EXISTS idx_wellness_user_date ON public.wellness(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.sessions(date);
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON public.sessions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user ON public.chat_room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON public.chat_messages(room_id, created_at DESC);
