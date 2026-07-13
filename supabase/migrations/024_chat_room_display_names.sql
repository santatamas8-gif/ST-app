-- Display names for chat: members of a room can read id/full_name/email of other members
-- so that names show correctly in chat (e.g. admin name for players).
-- Caller must be a member of the room.

CREATE OR REPLACE FUNCTION public.get_chat_room_display_names(p_room_id uuid)
RETURNS TABLE (user_id uuid, full_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id AS user_id, p.full_name, p.email
  FROM public.profiles p
  INNER JOIN public.chat_room_members m ON m.user_id = p.id AND m.room_id = p_room_id
  WHERE public.is_chat_room_member(p_room_id, auth.uid());
$$;
