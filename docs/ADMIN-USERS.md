# Admin Users / Roster

Admin-only page at **/admin/users** to create staff and player accounts and edit roles.

## Prerequisites

1. **Migration 004** – Add `full_name` (and `created_at` if missing) to `profiles`:
   - Run `supabase/migrations/004_profiles_full_name.sql` in Supabase SQL Editor.

2. **Service role key** – In `.env.local`:
   - `SUPABASE_SERVICE_ROLE_KEY` (from Supabase → Project Settings → API → service_role secret).  
   Required for creating auth users from the app.

## Profiles table (reference)

If you need to create the `profiles` table from scratch (e.g. new project), use:

```sql
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role text NOT NULL CHECK (role IN ('admin','staff','player')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Admin: full access. Staff: select all (optional). Player: select own only.
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
  );

CREATE POLICY "profiles_insert_admin"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR id = auth.uid()
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR id = auth.uid()
  );
```

If you already ran `add-admin-staff-policies.sql`, you only need migration 004 to add `full_name`.

## Access

- **Route:** `/admin/users`
- **Sidebar:** “Users” (visible only for role `admin`)
- **Guard:** Non-admin users are redirected to `/dashboard`.

## Test steps

1. **Admin creates staff**
   - Log in as admin → **Users** → **Create user**.
   - Full name: `Test Staff`, Email: `staff@test.com`, Password: `password123`, Role: **Staff** → **Create user**.
   - Success panel shows email and role (password is not shown again).
   - Log out (or use incognito), log in as `staff@test.com` / `password123`.
   - Sidebar should show Dashboard, Schedule, Players, Wellness, RPE (no “Users”). Role-based UI applies.

2. **Admin creates player**
   - As admin → **Create user** → Full name: `Test Player`, Email: `player@test.com`, Password: `password123`, Role: **Player** → **Create user**.
   - Log in as `player@test.com` / `password123`.
   - Only own wellness/RPE and no staff-only links.

3. **Edit role**
   - As admin → **Users** → find a user → **Edit role** → change e.g. Staff to Player → **Save**.
   - Next login for that user should reflect the new role (e.g. “Users” hidden if changed to player).

4. **Search and filter**
   - Use search by name/email and “All roles” / Admin / Staff / Player filter; list sorts newest first.

## Security

- User creation uses **server-side only** `SUPABASE_SERVICE_ROLE_KEY` (via `createAdminClient()` in server actions). Never expose the service role key to the client.
- Passwords are set by admin and sent only to Supabase Auth; they are not stored in the database in plain text.
