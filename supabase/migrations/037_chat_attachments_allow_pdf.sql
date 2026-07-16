-- Allow PDF (and clear old image-only MIME restriction) for chat attachments.
-- Run in Supabase SQL Editor if PDF upload still fails.

UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = NULL
WHERE id = 'chat-attachments';

-- Optional: original filename on messages (safe if already applied)
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachment_name text;
