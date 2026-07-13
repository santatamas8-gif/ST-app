# Kiosk RPE release checklist

Short checklist for deploying the Kiosk RPE and RPE analytics features to Vercel with live Supabase.

## Before deployment

- [ ] `npm test` passes (Kiosk RPE/Kiosk Lock suite included)
- [ ] `npx tsc --noEmit` passes
- [ ] Kiosk/analytics lint reviewed (`npx eslint` on changed feature files)
- [ ] `npm run build` passes
- [ ] Migration `027_sessions_kiosk_fields.sql` has been run in Supabase SQL Editor
- [ ] Migration `028_sessions_kiosk_batch_id.sql` has been run in Supabase SQL Editor
- [ ] `public.sessions.kiosk_batch_id` exists, is nullable, and has no database default
- [ ] Partial index `idx_sessions_kiosk_batch_id_created_at` exists
- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set in Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set in Vercel
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel (server-only; do not expose to browser)
- [ ] `KIOSK_PIN` is set in Vercel Production (server-only; never `NEXT_PUBLIC_`)
- [ ] No `.env` or secret files are staged in Git (`git status` clean of env files)

## Deploy

```bash
cd c:\Users\berde\st-app
git add .
git status
git commit -m "Kiosk RPE production readiness verification"
git push
```

If the Vercel project is connected to the Git repository, push to `master` triggers deployment. Otherwise use your existing Vercel workflow (manual deploy or CLI).

## After deployment

- [ ] Admin can open `/kiosk-rpe` and submit completed players
- [ ] Staff can open `/kiosk-rpe` and submit completed players
- [ ] Player cannot access Kiosk RPE (redirected from `/kiosk-rpe`; no sidebar item)
- [ ] One test entry stores correct RPE, duration, load, `session_type`, and `matchday_tag` in Supabase
- [ ] Submitted entry appears on `/rpe` (daily view and breakdown)
- [ ] Matchday Analysis, Player Comparison, Self-Baseline, and Team Baseline sections load for staff/admin
- [ ] Browser console has no errors on `/rpe` and `/kiosk-rpe`
- [ ] Network tab on staff `/rpe` shows deduplicated `matchday-analysis` requests (~2 on default load, not 4)

## Phase 11: Staff/Admin RPE workspace

### Environment and database

- [ ] Migration `027_sessions_kiosk_fields.sql` has been applied
- [ ] Migration `028_sessions_kiosk_batch_id.sql` has been applied
- [ ] No `.env`, PIN, Supabase key, or secret file is staged in Git
- [ ] `KIOSK_PIN` is configured separately for environments that use Kiosk Lock

### Role smoke test

- [ ] Admin sees the Staff/Admin `/rpe` workspace with all four top-level tabs
- [ ] Staff sees the same authorized analytical workspace
- [ ] Player sees only the player RPE load view, not Staff/Admin tabs or Kiosk history

### Overview

- [ ] Date selector works
- [ ] Today button resets the selected date
- [ ] Search filters both the daily chart and the player table
- [ ] Five KPIs are visible: Players submitted, Missing players, Average RPE, Average duration, Total load
- [ ] Today's Load by Player chart uses the selected date
- [ ] Player Daily Sessions table opens the existing player detail modal
- [ ] Multiple same-day sessions aggregate correctly per player
- [ ] Weekly, Acute, Chronic, At-risk, Spike, Status, and Only at-risk indicators are not visible in Overview

### Team Trends

- [ ] `/rpe?view=team` defaults to Load Trend
- [ ] Load Trend 7 / 14 / 28 day periods work
- [ ] Matchday Analysis Team and Individual modes work
- [ ] Matchday date range and Session Type filters work
- [ ] Compare Weeks Team-only mode uses the full width
- [ ] Compare Weeks Player mode shows team and player charts

### Player Analysis

- [ ] `/rpe?view=players` defaults to Compare Players
- [ ] Compare Players supports 2-4 selected players
- [ ] Compare Players date, Matchday, and Session Type filters work
- [ ] Self-Baseline player and period selectors work
- [ ] Self-Baseline recent and baseline windows remain non-overlapping
- [ ] Player vs Team excludes the selected player from the team comparison group
- [ ] Player vs Team sample counts and neutral interpretation text are visible

### Kiosk Sessions

- [ ] `/rpe?view=kiosk#recent-kiosk-sessions` opens and scrolls to Kiosk Sessions
- [ ] `/rpe#recent-kiosk-sessions` still opens and scrolls to Kiosk Sessions
- [ ] Latest batches are shown newest first
- [ ] Multiple same-day batches remain separate
- [ ] Batch Date, Time, Session Type, Matchday, Players, Avg RPE, and Total Load values are correct
- [ ] View details expands the correct batch
- [ ] Hide details collapses the batch
- [ ] Expanded details preserve stored player rows, including duplicate stored rows if present
- [ ] Tablet and mobile layouts remain readable and tappable

### Navigation

- [ ] Refresh preserves the active top-level tab
- [ ] Refresh preserves Team Trends `analysis`
- [ ] Refresh preserves Player Analysis `playerAnalysis`
- [ ] Browser Back works across top-level and internal tab changes
- [ ] Browser Forward works across top-level and internal tab changes
- [ ] Invalid `view`, `analysis`, or `playerAnalysis` values fall back safely

### Network

- [ ] Overview does not trigger hidden client analytics requests
- [ ] Team Load does not trigger Matchday analytics requests
- [ ] Matchday Analysis triggers only its required analytics request
- [ ] Player Comparison does not trigger Self-Baseline or Player vs Team analytics requests
- [ ] Switching analyses does not create a request loop
- [ ] Existing analytics request deduplication remains effective
- [ ] Kiosk Sessions continues to use the server-side Recent Kiosk Sessions path; hash-only compatibility may require Kiosk batch data to be available on initial Staff/Admin `/rpe` render

## Phase 9: Recent Kiosk Sessions

### Supabase

- [ ] Migration `027_sessions_kiosk_fields.sql` has been applied
- [ ] Migration `028_sessions_kiosk_batch_id.sql` has been applied
- [ ] `sessions.kiosk_batch_id` exists and is nullable
- [ ] `idx_sessions_kiosk_batch_id_created_at` exists

Recommended read-only checks:

```sql
SELECT
  kiosk_batch_id,
  COUNT(*) AS rows_in_batch,
  MIN(created_at) AS first_created_at,
  MAX(created_at) AS last_created_at
FROM public.sessions
WHERE kiosk_batch_id IS NOT NULL
GROUP BY kiosk_batch_id
ORDER BY first_created_at DESC
LIMIT 10;
```

```sql
SELECT
  id,
  user_id,
  date,
  rpe,
  duration,
  load,
  session_type,
  matchday_tag,
  kiosk_batch_id
FROM public.sessions
ORDER BY created_at DESC
LIMIT 50;
```

### Live smoke test

1. Open `/kiosk-rpe` as Admin or Staff.
2. Submit a Kiosk batch with at least two players.
3. Confirm all inserted rows share one `kiosk_batch_id`.
4. Confirm a normal Player RPE row has `kiosk_batch_id = null`.
5. Open `/rpe#recent-kiosk-sessions`.
6. Confirm the new batch appears once.
7. Expand it and verify player rows.
8. Submit another batch on the same date.
9. Confirm the same-day warning appears.
10. Confirm the two batches remain separate.
11. Confirm the Kiosk notice count increases.
12. Confirm Player cannot see or access these features.

## Phase 10: Kiosk Lock

### Environment

- [ ] `KIOSK_PIN` exists in local `.env.local`
- [ ] `KIOSK_PIN` exists in Vercel Production
- [ ] Preview/Development environments are configured if used
- [ ] `KIOSK_PIN` is server-only and not prefixed with `NEXT_PUBLIC_`
- [ ] Production PIN is preferably at least 4-6 digits
- [ ] Real PIN is not committed to source control

### Kiosk Lock live smoke test

1. Sign in as Admin.
2. Open `/kiosk-rpe`.
3. Confirm the PIN gate appears.
4. Enter a wrong PIN and confirm access remains blocked.
5. Enter the correct PIN.
6. Confirm normal navigation disappears.
7. Confirm refresh remains locked.
8. Confirm `/dashboard`, `/rpe`, and `/chat` return to Kiosk.
9. Confirm Kiosk Submit All still works.
10. Confirm Logout is unavailable.
11. Open Exit Kiosk.
12. Confirm Cancel keeps lock active.
13. Confirm wrong exit PIN keeps lock active.
14. Confirm correct exit PIN returns to Dashboard.
15. Confirm normal navigation and Logout return.
16. Repeat with Staff.
17. Confirm Player never sees the PIN gate and cannot access Kiosk.

### Failure checks

- [ ] Missing `KIOSK_PIN` shows a controlled unavailable message
- [ ] Network failure keeps Kiosk locked
- [ ] Expired authentication reaches Login without a redirect loop

### Security limitations

- Kiosk Lock protects the STAMS application workflow, not the operating system.
- Someone with full browser or device access may clear cookies, close the browser, or navigate outside the website.
- Development PINs such as `111` are not suitable for production.
- Store a stronger production PIN in Vercel environment variables, not source code.

## Environment variables (names only)

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
KIOSK_PIN=
```

Never commit real values. Keep `SUPABASE_SERVICE_ROLE_KEY` and `KIOSK_PIN` server-only in Vercel (not exposed to the browser).
