-- Profile avatar image URL (Supabase Storage avatars bucket).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;
