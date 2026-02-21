-- Daily program / schedule: breakfast, lunch, dinner, training, gym, recovery, pre_activation
-- Staff/admin edit; all (including players) can view.

CREATE TABLE IF NOT EXISTS public.schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN (
    'breakfast', 'lunch', 'dinner', 'training', 'gym', 'recovery', 'pre_activation'
  )),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_date ON public.schedule(date);

ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "schedule_select" ON public.schedule
  FOR SELECT TO authenticated USING (true);

-- Only staff/admin can insert/update/delete
CREATE POLICY "schedule_insert" ON public.schedule
  FOR INSERT WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','staff')
  );

CREATE POLICY "schedule_update" ON public.schedule
  FOR UPDATE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','staff')
  );

CREATE POLICY "schedule_delete" ON public.schedule
  FOR DELETE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','staff')
  );
