-- ============================================================
-- 1) Email a profiles táblába (Users oldalhoz + app)
-- ============================================================
alter table public.profiles
  add column if not exists email text not null default '';

-- Trigger frissítése: regisztrációnál másolja az email-t is
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, email)
  values (new.id, 'player', coalesce(new.email, ''))
  on conflict (id) do update set email = coalesce(excluded.email, profiles.email);
  return new;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 2) Segédfüggvény: aktuális user szerepköre (admin/staff lát mindent)
-- ============================================================
create or replace function public.current_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql stable security definer;

-- ============================================================
-- 3) PROFILES: admin és staff látja az ÖSSZES profilt (Users oldal)
--    player csak a sajátját (megtartjuk)
-- ============================================================
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or public.current_user_role() in ('admin', 'staff')
);

-- Admin módosíthat bárkit (pl. role), sajátot is
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (
  id = auth.uid() or public.current_user_role() = 'admin'
)
with check (
  id = auth.uid() or public.current_user_role() = 'admin'
);

-- Admin beszúrhat új profilt (pl. játékos hozzáadása)
drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
on public.profiles for insert
to authenticated
with check (
  id = auth.uid() or public.current_user_role() = 'admin'
);

-- ============================================================
-- 4) WELLNESS: admin és staff látja MINDENKI adatát (összesítés)
--    player csak a sajátját (megtartjuk)
-- ============================================================
drop policy if exists "wellness_select_own" on public.wellness;
create policy "wellness_select_own"
on public.wellness for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_role() in ('admin', 'staff')
);

-- ============================================================
-- 5) SESSIONS: admin és staff látja MINDENKI adatát (összesítés)
--    player csak a sajátját (megtartjuk)
-- ============================================================
drop policy if exists "sessions_select_own" on public.sessions;
create policy "sessions_select_own"
on public.sessions for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_role() in ('admin', 'staff')
);

-- ============================================================
-- 6) Opcionális: létező auth user emailjének feltöltése profiles-ba
--    (ha már voltak userek regisztráció előtt)
-- ============================================================
-- update public.profiles p
-- set email = u.email
-- from auth.users u
-- where p.id = u.id and (p.email is null or p.email = '');
