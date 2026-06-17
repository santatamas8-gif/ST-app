# Kiosk RPE release checklist

Short checklist for deploying the Kiosk RPE and RPE analytics features to Vercel with live Supabase.

## Before deployment

- [ ] `npm test` passes (101 tests)
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

## Environment variables (names only)

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Never commit real values. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only in Vercel (not exposed to the browser).
