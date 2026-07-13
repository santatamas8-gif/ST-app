-- Add status_notes and allow injured, rehab status.
ALTER TABLE public.player_status
  ADD COLUMN IF NOT EXISTS status_notes text;

-- Drop existing status check constraint
ALTER TABLE public.player_status DROP CONSTRAINT IF EXISTS player_status_status_check;

ALTER TABLE public.player_status
  ADD CONSTRAINT player_status_status_check
  CHECK (status IN ('available', 'limited', 'unavailable', 'injured', 'rehab'));
