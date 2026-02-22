-- Player status for dashboard (one row per player). Admin can set; staff read-only.
CREATE TABLE IF NOT EXISTS public.player_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'limited', 'unavailable')),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_player_status_user_id ON public.player_status(user_id);

ALTER TABLE public.player_status ENABLE ROW LEVEL SECURITY;

-- SELECT: staff and admin can see all
CREATE POLICY "player_status_select"
  ON public.player_status FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
  );

-- INSERT/UPDATE: only admin
CREATE POLICY "player_status_insert"
  ON public.player_status FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "player_status_update"
  ON public.player_status FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
