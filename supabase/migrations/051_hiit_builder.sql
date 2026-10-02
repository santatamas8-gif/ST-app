-- HIIT builder: player MAS/MSS (km/h) and saved sessions.
-- Admin and staff write. Players have no access.

CREATE TABLE IF NOT EXISTS public.hiit_player_speeds (
  player_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  mas_kmh numeric(6,2) NOT NULL CHECK (mas_kmh > 0),
  mss_kmh numeric(6,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id),
  CONSTRAINT hiit_player_speeds_mss_above_mas CHECK (mss_kmh > mas_kmh)
);

CREATE TABLE IF NOT EXISTS public.hiit_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'HIIT',
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hiit_sessions_title_nonempty CHECK (length(trim(title)) > 0)
);

CREATE TABLE IF NOT EXISTS public.hiit_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.hiit_sessions(id) ON DELETE CASCADE,
  group_index smallint NOT NULL CHECK (group_index BETWEEN 1 AND 3),
  intensity_basis text NOT NULL CHECK (intensity_basis IN ('mas', 'asr')),
  percent numeric(6,2) NOT NULL CHECK (percent >= 0),
  format text NOT NULL CHECK (format IN ('interval', 'shuttle')),
  work_sec integer NOT NULL CHECK (work_sec > 0),
  rest_sec integer NOT NULL CHECK (rest_sec >= 0),
  reps integer NOT NULL CHECK (reps > 0),
  sets integer NOT NULL CHECK (sets > 0),
  shuttle_count integer NOT NULL DEFAULT 2 CHECK (shuttle_count >= 1),
  start_loss_sec numeric(4,2) NOT NULL DEFAULT 0.7 CHECK (start_loss_sec >= 0),
  cod_loss_sec numeric(4,2) NOT NULL DEFAULT 1 CHECK (cod_loss_sec >= 0),
  UNIQUE (session_id, group_index)
);

CREATE TABLE IF NOT EXISTS public.hiit_group_players (
  group_id uuid NOT NULL REFERENCES public.hiit_groups(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_hiit_groups_session ON public.hiit_groups (session_id);
CREATE INDEX IF NOT EXISTS idx_hiit_sessions_date ON public.hiit_sessions (session_date DESC);

ALTER TABLE public.hiit_player_speeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiit_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiit_group_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hiit_player_speeds_staff" ON public.hiit_player_speeds;
CREATE POLICY "hiit_player_speeds_staff"
  ON public.hiit_player_speeds FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('admin', 'staff'));

DROP POLICY IF EXISTS "hiit_sessions_staff" ON public.hiit_sessions;
CREATE POLICY "hiit_sessions_staff"
  ON public.hiit_sessions FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('admin', 'staff'));

DROP POLICY IF EXISTS "hiit_groups_staff" ON public.hiit_groups;
CREATE POLICY "hiit_groups_staff"
  ON public.hiit_groups FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('admin', 'staff'));

DROP POLICY IF EXISTS "hiit_group_players_staff" ON public.hiit_group_players;
CREATE POLICY "hiit_group_players_staff"
  ON public.hiit_group_players FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('admin', 'staff'));
