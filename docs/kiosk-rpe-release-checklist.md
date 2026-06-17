# Kiosk RPE release checklist

Short checklist for deploying the Kiosk RPE and RPE analytics features to Vercel with live Supabase.

## Before deployment

- [ ] `npm test` passes (79 tests)
- [ ] `npx tsc --noEmit` passes
- [ ] Kiosk/analytics lint reviewed (`npx eslint` on changed feature files)
- [ ] `npm run build` passes
- [ ] Migration `027_sessions_kiosk_fields.sql` has been run in Supabase SQL Editor
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

## Environment variables (names only)

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Never commit real values. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only in Vercel (not exposed to the browser).
