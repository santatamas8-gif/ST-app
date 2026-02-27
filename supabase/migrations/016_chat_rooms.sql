-- Chat rooms: only admin can create/update/delete; all authenticated can read.
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (see room list)
CREATE POLICY "chat_rooms_select" ON public.chat_rooms
  FOR SELECT TO authenticated USING (true);

-- Only admin can insert (create rooms)
CREATE POLICY "chat_rooms_insert" ON public.chat_rooms
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Only admin can update
CREATE POLICY "chat_rooms_update" ON public.chat_rooms
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Only admin can delete
CREATE POLICY "chat_rooms_delete" ON public.chat_rooms
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
