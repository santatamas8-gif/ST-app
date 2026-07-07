-- Daily Strength Card system (admin builder + player published cards)

-- 1) Player strength profiles (1:1 with player)
CREATE TABLE IF NOT EXISTS public.strength_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bodyweight numeric,
  squat numeric,
  bench_press numeric,
  deadlift numeric,
  pull_up numeric,
  military_press numeric,
  clean numeric,
  snatch numeric,
  last_test_date date,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(player_id)
);

-- 2) Exercise database (imported from Excel)
CREATE TABLE IF NOT EXISTS public.strength_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT '',
  percent numeric NOT NULL DEFAULT 1,
  related_to text NOT NULL DEFAULT '',
  percent_bw_used numeric NOT NULL DEFAULT 0,
  equipment_used text NOT NULL DEFAULT '',
  rounding numeric NOT NULL DEFAULT 2.5,
  note text NOT NULL DEFAULT '',
  video_url text,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strength_exercises_active ON public.strength_exercises(active);
CREATE INDEX IF NOT EXISTS idx_strength_exercises_name ON public.strength_exercises(name);

-- 3) Set/rep schemes
CREATE TABLE IF NOT EXISTS public.strength_set_rep_schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  source_excel_name text,
  created_at timestamptz DEFAULT now()
);

-- 4) Scheme items
CREATE TABLE IF NOT EXISTS public.strength_set_rep_scheme_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id uuid NOT NULL REFERENCES public.strength_set_rep_schemes(id) ON DELETE CASCADE,
  week_number integer,
  set_number integer NOT NULL,
  percentage numeric NOT NULL,
  reps integer NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_strength_scheme_items_scheme ON public.strength_set_rep_scheme_items(scheme_id);

-- 5) Daily sessions
CREATE TABLE IF NOT EXISTS public.daily_strength_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  title text NOT NULL,
  session_type text NOT NULL DEFAULT 'Full Body',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6) Session exercises (1–8 per session)
CREATE TABLE IF NOT EXISTS public.daily_strength_session_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.daily_strength_sessions(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.strength_exercises(id) ON DELETE RESTRICT,
  exercise_order integer NOT NULL CHECK (exercise_order >= 1 AND exercise_order <= 8)
);

CREATE INDEX IF NOT EXISTS idx_daily_strength_session_exercises_session ON public.daily_strength_session_exercises(session_id);

-- 7) Session sets per exercise
CREATE TABLE IF NOT EXISTS public.daily_strength_session_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_exercise_id uuid NOT NULL REFERENCES public.daily_strength_session_exercises(id) ON DELETE CASCADE,
  set_number integer NOT NULL,
  reps integer NOT NULL,
  percentage numeric NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_strength_session_sets_exercise ON public.daily_strength_session_sets(session_exercise_id);

-- 8) Generated player cards
CREATE TABLE IF NOT EXISTS public.daily_strength_player_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.daily_strength_sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at timestamptz DEFAULT now(),
  published_at timestamptz,
  UNIQUE(session_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_strength_player_cards_player ON public.daily_strength_player_cards(player_id);
CREATE INDEX IF NOT EXISTS idx_daily_strength_player_cards_session ON public.daily_strength_player_cards(session_id);

-- 9) Frozen card line items (historical snapshot)
CREATE TABLE IF NOT EXISTS public.daily_strength_player_card_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.daily_strength_player_cards(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES public.strength_exercises(id) ON DELETE SET NULL,
  exercise_name_snapshot text NOT NULL,
  exercise_image_url_snapshot text,
  set_number integer NOT NULL,
  reps integer NOT NULL,
  percentage numeric NOT NULL,
  reference_lift text NOT NULL DEFAULT '',
  reference_value numeric,
  exercise_percent numeric NOT NULL,
  percent_bw_used numeric NOT NULL DEFAULT 0,
  rounding numeric NOT NULL DEFAULT 2.5,
  raw_weight numeric,
  calculated_weight numeric,
  coach_adjusted_weight numeric,
  display_weight text NOT NULL DEFAULT '',
  load_type text NOT NULL DEFAULT 'barbell',
  note_snapshot text NOT NULL DEFAULT '',
  exercise_order integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_daily_strength_card_items_card ON public.daily_strength_player_card_items(card_id);

-- Helper: admin check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- RLS
ALTER TABLE public.strength_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strength_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strength_set_rep_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strength_set_rep_scheme_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_strength_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_strength_session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_strength_session_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_strength_player_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_strength_player_card_items ENABLE ROW LEVEL SECURITY;

-- strength_profiles: admin only
CREATE POLICY "strength_profiles_admin_all"
  ON public.strength_profiles FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- strength_exercises: admin only
CREATE POLICY "strength_exercises_admin_all"
  ON public.strength_exercises FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- schemes: admin only
CREATE POLICY "strength_schemes_admin_all"
  ON public.strength_set_rep_schemes FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "strength_scheme_items_admin_all"
  ON public.strength_set_rep_scheme_items FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- sessions: admin full access
CREATE POLICY "daily_strength_sessions_admin_all"
  ON public.daily_strength_sessions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "daily_strength_session_exercises_admin_all"
  ON public.daily_strength_session_exercises FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "daily_strength_session_sets_admin_all"
  ON public.daily_strength_session_sets FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- player cards: admin all; players see own published only
CREATE POLICY "daily_strength_player_cards_admin_all"
  ON public.daily_strength_player_cards FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "daily_strength_player_cards_player_select"
  ON public.daily_strength_player_cards FOR SELECT
  USING (
    player_id = auth.uid() AND status = 'published'
  );

-- card items: admin all; players via own published card
CREATE POLICY "daily_strength_card_items_admin_all"
  ON public.daily_strength_player_card_items FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "daily_strength_card_items_player_select"
  ON public.daily_strength_player_card_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_strength_player_cards c
      WHERE c.id = card_id
        AND c.player_id = auth.uid()
        AND c.status = 'published'
    )
  );
