# ST App

Professional web application built with **Next.js** (App Router), **TypeScript**, and **Tailwind CSS**, using **Supabase** for authentication and database.

## Features

- **Email login** (sign in / sign up)
- **Role-based access**: `admin`, `staff`, `player`
- **Protected routes**: `/dashboard`, `/wellness`, `/rpe`, `/users` (admin only)
- **Wellness module**: Bed/wake time, sleep duration (auto), sleep quality, muscle soreness, fatigue, stress, mood, optional bodyweight
- **RPE module**: Session duration, RPE (1–10), auto-calculated load (duration × RPE)
- **Pro dashboard**: Today wellness average, average sleep hours, weekly load, monotony, strain, readiness (0–100), red-flag detection, 7-day and 28-day trend charts
- **Dark UI** with card-based layout, sidebar navigation, and Recharts trend graphs

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **Settings → API**, copy the project URL and the **anon** (public) key.
3. Create `.env.local` in the project root (see `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. In the Supabase **SQL Editor**:
   - **New project**: run the full `supabase/schema.sql` to create tables and RLS.
   - **Existing project** (tables already created): run `supabase/migrations/001_wellness_rpe_columns.sql` to add wellness and session columns.
5. After your first sign-up, promote a user to admin:

```sql
update public.users set role = 'admin' where email = 'your@email.com';
```

### 3. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in and use **Wellness** and **RPE** to log data; **Dashboard** shows metrics and trends.

## Project structure

- `app/` – App Router routes and layouts
  - `(app)/` – Dashboard layout (sidebar) and protected pages: dashboard, wellness, rpe, users
  - `actions/` – Server actions (wellness, sessions)
  - `login/`, `signup/`, `auth/callback/`
- `components/` – Reusable UI: `Card`, `Sidebar`, `ScaleInput`, `WellnessForm`, `RpeForm`, `MetricCard`, `RedFlagsCard`, `TrendCharts`
- `lib/` – Supabase client/server/middleware, auth helpers, types, dashboard data
- `utils/` – Calculations: `sleep` (duration), `load`, `metrics` (monotony, strain), `readiness`, `redFlags`, `wellness` (averages)

## Roles

| Role   | Access |
|--------|--------|
| admin  | Full access; **Users** page and all data |
| staff  | View aggregated metrics and trends (all users’ data) |
| player | Submit and view only own wellness and sessions |

## Red flags (dashboard)

- Wellness average &lt; 5  
- Sleep &lt; 6 h  
- Monotony &gt; 2  
- Load spike &gt; 30% vs previous week  
- Fatigue &gt; 8  

Red-flag cards are highlighted in the dashboard when detected.
