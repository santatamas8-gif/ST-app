-- Allow larger PDFs + clear MIME restriction for chat attachments.
-- Run in Supabase SQL Editor (fixes Vercel 413 by enabling direct uploads up to 20MB).

UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = NULL
WHERE id = 'chat-attachments';

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachment_name text;

