-- Kiosk RPE: durable identifier for one Submit All batch.
-- Nullable so legacy sessions and normal player RPE submissions remain valid.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS kiosk_batch_id uuid;

CREATE INDEX IF NOT EXISTS idx_sessions_kiosk_batch_id_created_at
ON public.sessions (kiosk_batch_id, created_at DESC)
WHERE kiosk_batch_id IS NOT NULL;
