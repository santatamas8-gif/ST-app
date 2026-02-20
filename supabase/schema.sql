-- ============================================================
-- ST App – Supabase schema + RLS
-- Futtasd a Supabase SQL Editorban (Dashboard → SQL Editor).
-- ============================================================
-- Szerepkörök: admin = te (összesítés + user kezelés), staff = edzői stáb (összesítés), player = játékos (csak saját adat, telefonról kitölti).
-- ============================================================

-- 1) users – szerepkör tábla (auth.users id-hoz kötve)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'player' CHECK (role IN ('admin','staff','player')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2) wellness – napi wellness (sleep, fatigue, soreness, stress, mood)
CREATE TABLE IF NOT EXISTS public.wellness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  bed_time time,
  wake_time time,
  sleep_duration numeric,
  sleep_quality numeric,
  soreness numeric,
  fatigue numeric,
  stress numeric,
  mood numeric,
  bodyweight numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 3) sessions – edzés / RPE (date, duration, rpe, load)
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  duration numeric NOT NULL,
  rpe numeric,
  load numeric,
  created_at timestamptz DEFAULT now()
);

-- Indexek
CREATE INDEX IF NOT EXISTS idx_wellness_user_date ON public.wellness(user_id, date);
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON public.sessions(user_id, date);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Helper: aktuális user szerepköre (null ha nincs sor)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- --- users ---
-- SELECT: admin és staff látja az összeset, player csak a saját sorát
CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (
    public.current_user_role() IN ('admin','staff') OR id = auth.uid()
  );
-- INSERT: saját sor (első belépés) VAGY admin bárkit hozzáadhat (pl. játékos fake email)
CREATE POLICY "users_insert" ON public.users
  FOR INSERT WITH CHECK (
    id = auth.uid() OR public.current_user_role() = 'admin'
  );
-- UPDATE: admin bárkit módosíthat (pl. role), user a saját sorát
CREATE POLICY "users_update" ON public.users
  FOR UPDATE USING (
    public.current_user_role() = 'admin' OR id = auth.uid()
  );

-- --- wellness ---
-- SELECT: admin/staff összesítés (mindenki), player csak a sajátja
CREATE POLICY "wellness_select" ON public.wellness
  FOR SELECT USING (
    public.current_user_role() IN ('admin','staff') OR user_id = auth.uid()
  );
-- INSERT: csak a saját adat (játékos kitölti telefonról)
CREATE POLICY "wellness_insert" ON public.wellness
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- --- sessions ---
-- SELECT: admin/staff összesítés, player csak a sajátja
CREATE POLICY "sessions_select" ON public.sessions
  FOR SELECT USING (
    public.current_user_role() IN ('admin','staff') OR user_id = auth.uid()
  );
-- INSERT: csak a saját
CREATE POLICY "sessions_insert" ON public.sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Első admin user beállítása
-- ============================================================
-- Miután létrehoztad magad a Supabase Auth-ban (Sign up / vagy Auth → Users → Add),
-- futtasd egyszer (cseréld ki YOUR_AUTH_UID és email-re):
--
-- INSERT INTO public.users (id, email, role)
-- VALUES ('YOUR_AUTH_UID', 'te@email.com', 'admin')
-- ON CONFLICT (id) DO UPDATE SET role = 'admin', email = EXCLUDED.email;
--
-- YOUR_AUTH_UID = Supabase Auth → Users → a user UUID-ja.
-- ============================================================
