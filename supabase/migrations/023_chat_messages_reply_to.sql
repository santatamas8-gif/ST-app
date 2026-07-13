-- Add optional reply reference to chat messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS chat_messages_reply_to_message_id
  ON public.chat_messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
