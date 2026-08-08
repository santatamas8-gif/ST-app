-- Formalize verified production chat-attachments bucket MIME configuration.
-- Historical 037 set allowed_mime_types = NULL; live ST-AMS uses an explicit allowlist
-- matching app upload validation (prepare-attachment / upload-attachment).
-- Bucket creation is not performed here (historical/runtime-managed outside migrations).

UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/x-png',
    'application/pdf',
    'application/x-pdf',
    'application/octet-stream'
  ]::text[]
WHERE id = 'chat-attachments';
