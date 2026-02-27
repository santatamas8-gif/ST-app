-- Admin can delete any message (not only own)
CREATE POLICY "chat_messages_delete_admin" ON public.chat_messages
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
