-- Add wellness and session columns for Phase 2
-- Run in Supabase SQL Editor if tables already exist with only id/user_id/created_at.

-- Wellness: add columns (use IF NOT EXISTS via DO block for idempotency)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wellness' and column_name = 'date') then
    alter table public.wellness add column date date not null default current_date;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wellness' and column_name = 'bed_time') then
    alter table public.wellness add column bed_time time;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wellness' and column_name = 'wake_time') then
    alter table public.wellness add column wake_time time;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wellness' and column_name = 'sleep_duration') then
    alter table public.wellness add column sleep_duration numeric(4,2);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wellness' and column_name = 'sleep_quality') then
    alter table public.wellness add column sleep_quality smallint check (sleep_quality >= 1 and sleep_quality <= 10);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wellness' and column_name = 'soreness') then
    alter table public.wellness add column soreness smallint check (soreness >= 1 and soreness <= 10);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wellness' and column_name = 'fatigue') then
    alter table public.wellness add column fatigue smallint check (fatigue >= 1 and fatigue <= 10);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wellness' and column_name = 'stress') then
    alter table public.wellness add column stress smallint check (stress >= 1 and stress <= 10);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wellness' and column_name = 'mood') then
    alter table public.wellness add column mood smallint check (mood >= 1 and mood <= 10);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wellness' and column_name = 'bodyweight') then
    alter table public.wellness add column bodyweight numeric(5,2);
  end if;
end $$;

-- Sessions: add columns
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sessions' and column_name = 'date') then
    alter table public.sessions add column date date not null default current_date;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sessions' and column_name = 'duration') then
    alter table public.sessions add column duration smallint not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sessions' and column_name = 'rpe') then
    alter table public.sessions add column rpe smallint check (rpe >= 1 and rpe <= 10);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sessions' and column_name = 'load') then
    alter table public.sessions add column load numeric(8,2);
  end if;
end $$;
