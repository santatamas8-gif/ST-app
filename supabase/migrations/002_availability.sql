-- Availability per player per day: available | injured | unavailable
-- Staff/admin set this when viewing a player.

CREATE TABLE IF NOT EXISTS public.availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('available', 'injured', 'unavailable')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_availability_user_date ON public.availability(user_id, date);

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

-- SELECT: staff/admin see all, player sees own
CREATE POLICY "availability_select" ON public.availability
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','staff')
    OR user_id = auth.uid()
  );

-- INSERT/UPDATE: only staff/admin
CREATE POLICY "availability_insert" ON public.availability
  FOR INSERT WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','staff')
  );

CREATE POLICY "availability_update" ON public.availability
  FOR UPDATE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','staff')
  );

CREATE POLICY "availability_delete" ON public.availability
  FOR DELETE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','staff')
  );
