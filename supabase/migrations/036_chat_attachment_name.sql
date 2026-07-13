-- Store original filename for chat attachments (e.g. PDF uploads).
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachment_name text;
