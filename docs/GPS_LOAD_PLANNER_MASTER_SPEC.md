# ST-AMS GPS Load Planner — Master Specification (V1)

**Status:** Authoritative project specification  
**Scope:** GPS Load Planner V1 only  
**Last architecture lock:** Weekly Planner production final; Daily Plan final redesign (landscape + secondary summaries)

This document is the **single source of truth** for GPS Load Planner V1.  
Any Cursor agent or human implementing planner work **must read this file first**.  
Approved business rules in this document **must not be changed by an agent**.  
If anything is ambiguous: **STOP and report** — do not invent silently.

---

## A. Core philosophy

```
USER DECIDES
→ SYSTEM CALCULATES
→ USER INTERPRETS / DECIDES AGAIN
```

The system must **NOT** automatically coach.

**Forbidden automatic behaviors (V1 and unless explicitly re-approved later):**

- weekly target recommendations
- top-up prescription
- starter / non-starter classification
- position multipliers
- load redistribution
- carry-over
- microdosing
- injury-risk decisions
- percentage correction / auto-fix of daily or weekly values

Warnings may **inform** the Admin.  
Warnings must **never** silently modify the plan.

---

## B. Access control — FINAL DECISION (ADMIN ONLY)

GPS Load Planner V1 is **ADMIN ONLY** for the **entire** feature.

This supersedes any earlier staff+admin planner suggestions.

### Admin

- may see planner navigation
- may access planner routes/pages
- may read planner data
- may create/update/delete planner data (with confirmation where destructive)
- may manage Power BI player mappings (`player_external_mappings`)

### Staff

- **NO** planner UI
- **NO** planner routes
- **NO** planner Supabase SELECT
- **NO** planner INSERT / UPDATE / DELETE
- **NO** `player_external_mappings` access (read or write)

### Player

- **NO** planner UI
- **NO** planner routes
- **NO** planner Supabase SELECT
- **NO** planner INSERT / UPDATE / DELETE
- **NO** `player_external_mappings` access

### Enforcement layers (all required)

Security must **not** rely only on hidden navigation.

1. UI / navigation  
2. Route / server boundary using existing ST-AMS auth helpers  
3. Server actions  
4. Supabase RLS  

**Reuse:**

- `getAppUser()` — `lib/auth.ts`
- `isAdmin()` — `lib/auth.ts`
- `public.current_user_role()` — Supabase

Normal planner CRUD must **not** use the service-role client to bypass RLS.

`player_external_mappings` is **ADMIN ONLY** for both read and write.

---

## C. Existing ST-AMS player identity

There is **NO** separate `players` table.

| Concept | Exact current model |
|---|---|
| Canonical player rows | `public.profiles` where `role = 'player'` |
| Identity | `profiles.id` **uuid** = `auth.users.id` |
| Canonical display name | `profiles.full_name` |
| Name uniqueness | Names are **NOT** unique; never use as permanent internal identity |

**Do not** create another player table.  
**No** team / season / player-position model is required for Planner V1.

---

## D. Power BI architecture

Existing data pipeline (unchanged):

```
STATSports / Sonra
→ existing CSV / Excel / OneDrive pipeline
→ Power BI Desktop
→ manual Refresh
→ manual Publish / Replace
→ Power BI Service semantic model
→ ST-AMS server-side Power BI connector
```

- ST-AMS does **NOT** ingest raw GPS CSV files directly.
- Power BI remains the source of truth for GPS **facts**.

### Existing production code (reuse; do not rebuild without explicit need)

| Area | Location |
|---|---|
| Connector | `lib/powerbi/` |
| Public API | `executePowerBiDaxQuery` from `@/lib/powerbi/client.server` |
| Training Actual | `getTrainingActualGps(...)` — `lib/powerbi/queries/trainingActual.server.ts` |
| Match Best | `getMatchBestGps(...)` — `lib/powerbi/queries/matchBest.server.ts` |

---

## E. Power BI semantic model — Training Actual (verified)

**Table:** `GPS_Log`

**Columns used:**

- `Player`
- `Week ID`
- `MD_Tag`
- `Drill`
- `Date`
- `TD`
- `Z5`
- `Z6`
- `Acc`
- `Dec`

**Planner metric mapping:**

| Planner metric | Column |
|---|---|
| TD | `GPS_Log[TD]` |
| HSR | `GPS_Log[Z5]` |
| Sprint | `GPS_Log[Z6]` |
| Accelerations | `GPS_Log[Acc]` |
| Decelerations | `GPS_Log[Dec]` |

**Actual filter:**

- `Player`
- `Week ID`
- `MD_Tag`
- `Drill` = exactly `"Full Training"`
- `Date` when available / needed for disambiguation

Primary production filtering uses these **dedicated columns**.  
Do **NOT** use `SourceFile` parsing as the primary production strategy.

**Row behavior:**

| Rows | Result |
|---|---|
| 0 | `not_found` |
| 1 | success |
| >1 | `ambiguous` |

**NEVER** silently `SUM` / `MAX` / `MIN` duplicate Full Training rows.

---

## F. Match Best — verified mapping

**Table:** `Match_Benchmark`

| Concept | Field |
|---|---|
| Player | `Match_Benchmark[Player]` |
| Method | `Match_Benchmark[Method]` |
| Required method | `"single-match best"` |
| TD Best | `Max TD` |
| HSR Best | `Max Z5` |
| Sprint Best | `Max Z6` |
| Acc Best | `Max Acc` |
| Dec Best | `Max Dec` |

- Do **NOT** calculate Match Best in ST-AMS.
- Different metric bests may originate from different matches.
- Planner reference = **single-match best per metric**.
- Do **NOT** use Top-3 average or rolling benchmark.

---

## G. Planner metrics — V1 only

The planner contains **ONLY:**

1. Total Distance (TD)  
2. HSR (= Z5)  
3. Sprint (= Z6)  
4. Accelerations  
5. Decelerations  

**Out of Planner V1** (may remain in other reports):

- Z4 Tempo  
- HMLD  
- Distance/min  
- Max Speed  

---

## H. Week model

V1 supports **SINGLE-MATCH WEEKS ONLY**.

A planner week has conceptually:

- internal UUID  
- Power BI Week ID (e.g. `W6`) — **not** globally unique alone  
- `start_date`  
- `end_date`  
- `week_type`  
- `overload_focus`  
- `status`  
- creator / timestamps  

### Week types

- `deload`  
- `maintaining`  
- `overload`  

### Overload focus

Zero or more of: `td` | `hsr` | `sprint` | `acc` | `dec`

- Overload Focus is **INFORMATIONAL ONLY**.  
- It must **NOT** change calculations automatically.  
- If `week_type` is **not** `overload`, `overload_focus` **must be empty**.  
- An overload week **may** have an empty focus if Admin chooses general overload.

---

## I. Practical weekly benchmarks (reference only)

Complementary Training values are **REFERENCE RANGES ONLY**.  
They are **NOT** automatic prescriptions.  
Game exposure is **excluded** from these weekly training targets.

| Week type | TD | HSR | Sprint | Acc | Dec |
|---|---|---|---|---|---|
| DELOAD | 120–150% | 60–100% | 60–100% | 200% | 200% |
| MAINTAINING | 200–250% | 100–150% | 100–150% | 300% | 300% |
| OVERLOAD | 250–300% | 200% | 200% | 350–400% | 300–400% |

- Admin **manually** chooses exact Weekly Target %.  
- Do **NOT** automatically set values from these ranges.  
- **No DB maximum** such as 300%.  
- DB percentage rule: `>= 0`  
- UI may later soft-warn unusual values but must **not** block intentional values (e.g. 350–400% Acc/Dec).

---

## J. Player groups

Groups are **WEEK-SCOPED** selection helpers.

Examples: Starters, Non-Starters, Custom.

- **NOT** a physiological classification engine  
- **NOT** owners of targets  
- **MUST** belong to a planner week (`week_id`)  
- Changing membership later must **NOT** modify existing weekly/daily player targets  
- Applying values to a group creates **player-specific** target rows  

Example: apply HSR 140% to Starters → each selected player gets 140%; Player C may later be edited to 160% independently.

Do **not** store target ownership by group.

---

## K. Starter / non-starter logic

- **NO** automatic starter/non-starter detection.  
- Admin manually chooses players (Matchday Report + coaching context).  
- **NO** automatic top-up formula.  
- **REJECTED:** `TopUp = MatchBest - MatchActual`  

Post-match recovery/top-up may be decided **manually** later; not automated in V1.

---

## L. Frozen Match Best snapshot

Each player/week has **ONE** frozen Match Best snapshot.

When a player receives their **first** Weekly Target in a planner week:

1. Resolve ST-AMS UUID  
2. Resolve exact Power BI mapping  
3. Call existing `getMatchBestGps`  
4. Create snapshot  
5. Create Weekly Target  

Snapshot stores:

- `td_best`, `hsr_best`, `sprint_best`, `acc_best`, `dec_best`  
- frozen Power BI player name  
- source method (`single-match best`)  

Key: one row per `week_id + player_id`.

**Immutability (V1):**

- Once created, snapshot values are **IMMUTABLE**.  
- Do **NOT** auto-refresh.  
- Do **NOT** overwrite when Power BI Match Best changes.  

**Historical Actual queries for that planner week** must use the **frozen** Power BI player name from the snapshot — **not** the current `player_external_mappings` value.

---

## M. Power BI player mapping

Live table: `player_external_mappings` (migration `039`; ADMIN-only RLS).

Purpose: ST-AMS UUID → exact external Power BI player identity.

| Concept | Rule |
|---|---|
| V1 provider | `powerbi` |
| Authoritative ID | `profiles.id` |
| One mapping per ST-AMS player | yes (`provider` + `player_id`) |
| One external name → one ST-AMS player | yes (`provider` + `external_player_name`) |
| Stored name | Exact semantic-model `Player` string from approved candidates (no case/space/punctuation rewrite) |
| Fuzzy / guessed names | forbidden |
| Position mapping | forbidden |
| Second player DB | forbidden |

**Access:** ADMIN ONLY (SELECT / INSERT / UPDATE / DELETE). Staff and Player: none.

Conceptual fields: `id`, `player_id`, `provider`, `external_player_name`, audit timestamps / users.

---

## N. Week days

Dynamic rows in `planner_week_days` — **not** fixed MD columns.

Conceptual fields: `id`, `week_id`, `date`, `md_tag`, `display_order`

Rules:

- one date once per week → `UNIQUE (week_id, date)`  
- one display_order once per week → `UNIQUE (week_id, display_order)`  
- day `date` must lie between week `start_date` and `end_date`  
- do **NOT** make `(week_id, md_tag)` unique (future two-match compatibility)  
- V1 remains single-match only  

Also: `UNIQUE (id, week_id)` to enable composite FKs from daily targets.

---

## O. Weekly Target

- Player-specific  
- One row per `week_id + player_id`  
- Metrics: `td_pct`, `hsr_pct`, `sprint_pct`, `acc_pct`, `dec_pct`  
- Manually selected by Admin  
- Absolute planned (derived, not stored): `Frozen Match Best × Weekly Target %`  
- Must have existing frozen snapshot for same week/player  
- Enforce with composite FK:

```text
planner_weekly_targets (week_id, player_id)
  → planner_match_best_snapshots (week_id, player_id)
```

---

## P. Daily Target

- Player-specific  
- One row per `week_day + player`  
- Metrics: same five percentages  

**CRITICAL:** Daily % is relative to the **same frozen Match Best**, **not** a percentage of the Weekly Target.

Example: Frozen HSR Best = 800 m, Daily HSR = 50% → planned = 400 m.

**DB integrity (composite FKs, not app-only):**

1. `(week_id, player_id)` → `planner_weekly_targets (week_id, player_id)`  
2. `(week_day_id, week_id)` → `planner_week_days (id, week_id)`  

No duplicate `(week_day_id, player_id)`.

---

## Q. Weekly → daily allocation

```text
Remaining to Allocate = Weekly Target % − SUM(Daily Target %)
```

| Sign | Meaning |
|---|---|
| positive | still needs allocation |
| zero | fully allocated |
| negative | over-allocated |

**Warning / planning info only.**  
Do **not** auto-redistribute, auto-correct, or hard-enforce equality in the DB.

---

## R. Actual data

- Remains live in Power BI  
- **No** Supabase GPS Actual mirror table  
- Daily Actual = Power BI Full Training via `getTrainingActualGps`  
- Weekly Actual = sum of elapsed Daily Actuals  
- Do **not** include the game in weekly training Actual  

For a historical planner week, resolve player via **snapshot frozen name**, then query with that week’s Power BI Week ID + day MD_Tag (+ Date as needed).

---

## S. Difference / To Target — sign convention

```text
Difference = Planned − Actual
```

| Sign | Meaning |
|---|---|
| positive | still missing |
| zero | target reached |
| negative | over target |

Weekly:

```text
Weekly To Target = Weekly Planned − Weekly Actual
```

Do **not** reverse this convention anywhere.

---

## T. Values not stored (normally)

Do **not** persist unless a future integrity case is explicitly approved:

- Weekly absolute planned  
- Daily absolute planned  
- Daily Actual / Weekly Actual  
- Difference / Weekly To Target  
- Remaining allocation  
- compliance colors  

Supabase stores: **planning inputs + frozen historical snapshots**.  
Power BI stores: **GPS facts**.

---

## U. Daily Plan / print

Professional printable coaching sheet (**implemented**, browser / A4 **landscape**, read-only):

**Primary (dominant):**

- Header: `Daily Plan` + `Week {powerBiWeekId} · Match Day {mdTag}`
- Existing app/team logo (small, corner only)
- Player table columns exactly: Player / TD / HSR / Sprint / Acc / Dec  
  (no `(m)` / `(count)` units in headers)
- Absolute Daily Planned values = Frozen Match Best × Daily % / 100 (existing domain)
- Missing Daily Target → player name + `—` (never zero)

**Secondary (right column, visually subordinate):**

- Weekly % summary (shared % across printed players with a Weekly Target; else `Mixed` / `—`)
- Daily % summary for the selected Week Day (same Mixed / — rules; never average %)
- Daily Team Average of valid absolute Daily Planned values only  
  (missing targets excluded — never zeroed; not persisted)

**History:** Daily Plan is projected from existing persisted Planner records  
(`planner_weeks` → `planner_week_days` → weekly/daily targets + frozen Match Best).  
No print-history / archive tables.

**Do not** show on print: Match Best values, Previous Week, Actual, Difference,  
To Target, Remaining to Allocate, Wellness/RPE, mapping status, charts, icons,  
automatic coaching.

---

## V. Plan compliance colors (if introduced later)

Colors = **plan compliance only**.  
Not injury risk, readiness, medical warning, or biological safety.

---

## W. V1 exclusions

Do **not** implement in V1:

- two-match-week logic  
- season model  
- team membership model  
- position-specific targets  
- automatic starter detection  
- automatic top-up / microdosing / carry-over  
- automatic plan revision  
- Original vs Revised history  
- previous-week planner targets  
- automated injury-risk calculations  

---

## X. Database design — approved direction

### Tables

| Table | Purpose |
|---|---|
| `player_external_mappings` | ST-AMS UUID ↔ Power BI player name |
| `planner_weeks` | Microcycle header |
| `planner_week_days` | Dynamic training days |
| `planner_groups` | Week-scoped selection helpers |
| `planner_group_members` | Group membership |
| `planner_match_best_snapshots` | Frozen Match Best per week+player |
| `planner_weekly_targets` | Player weekly % targets |
| `planner_daily_targets` | Player daily % targets |

All planner entities + mappings: **ADMIN ONLY** (RLS + app).

### Key integrity

- Weekly Target → snapshot composite FK  
- Daily Target → weekly target composite FK **and** week_day+week composite FK  
- Groups week-scoped; targets never FK groups  
- Snapshot metric / name / source fields immutable  
- Day date inside week range  
- `UNIQUE (week_id, display_order)` on days  

Detailed column-level design from the approved architecture discussion remains the migration blueprint; migration SQL is **not** created in this documentation phase.

---

## Y. Deletion safety

Deleting a planner week may cascade: days → snapshots → weekly targets → daily targets → groups/members.

- Admin only  
- Explicit application confirmation when implemented  
- No silent destructive operations  

---

## Z. Implementation safety rules

Before modifying any existing module:

1. Inspect it  
2. Understand current behavior  
3. Reuse existing architecture  
4. Do not rewrite unrelated code  

Never guess schema names, field names, Supabase relationships, Power BI fields, or auth/route behavior.

If uncertain: **STOP and report**.

After every implementation phase:

- ESLint  
- `tsc --noEmit`  
- full Vitest suite  
- targeted new tests  
- report files created/modified  
- report any existing behavior affected  

Existing Wellness / RPE / Strength / Recovery / Schedule functionality must remain unchanged unless explicitly required.

---

## Current project status

### Complete

- Power BI Service configured  
- Service principal configured  
- Server-only Power BI connector built (`lib/powerbi/`)  
- Live Execute Queries validated  
- Semantic-model schema introspected  
- `getTrainingActualGps` implemented  
- `getMatchBestGps` implemented  
- Duplicate / `not_found` / `ambiguous` behavior implemented  
- Existing ST-AMS player/auth schema inspected  
- Planner relational architecture designed  
- This master specification + agent structure established  
- Migration history reconciled (`001`–`037` applied in remote history; no `005`)  
- Migration `038_chat_attachments_mime_reconciliation.sql` applied to production  
- Migration `039_gps_load_planner.sql` applied to production  
- All 8 Planner tables live (`player_external_mappings` + `planner_*`)  
- ADMIN-only RLS live on all planner tables + mappings  
- Database integrity verified (constraints, composite FKs, triggers)  
- Production transactional DB tests 1–14 passed (ROLLBACK; zero leftover rows)  
- ADMIN-only player ↔ Power BI mapping server/domain layer (`lib/gpsPlanner/playerMappings.server.ts`)  
- Power BI player candidate query (`getPowerBiPlayerCandidates` / union + flags)  
- Player identity exactness verified (store exact `candidate.playerName`)  
- Planner Phase A domain: weeks / week days / week-scoped groups + members (`lib/gpsPlanner/weeks.server.ts`, `weekDays.server.ts`, `groups.server.ts`)  
- Migration `040_planner_atomic_snapshot_weekly_target.sql` applied (atomic ADMIN RPC)  
- Migration `041_planner_atomic_rpc_privilege_hardening.sql` applied (EXECUTE: authenticated only; PUBLIC/anon/service_role revoked)  
- `040/041 RPC SECURITY VERIFIED: YES`  
- Planner Phase B domain: Frozen Match Best snapshot read/reuse + Weekly Target CRUD + derived weekly absolutes (`lib/gpsPlanner/weeklyTargets.server.ts`, `calculations.ts`)  
- Planner Phase C domain: Daily Target CRUD + Daily Actual/Analysis + Weekly Progress (`lib/gpsPlanner/dailyTargets.server.ts`, `progress.server.ts`); week-day delete requires `confirm: true`  
- Weekly Planner UI (ADMIN ONLY): `/admin/planner` layout + page + `WeeklyPlannerView`, Sidebar nav (`PLANNER_NAV_ITEM`, admin-only), thin server actions (`app/actions/gpsPlanner.ts`), display helpers (`lib/gpsPlanner/uiDisplay.ts`)  
- Destructive confirm gates in UI for week / week-day / weekly-target / daily-target deletes (domain still requires `confirm: true`)  
- Multi-player Weekly Target apply orchestration (`applyWeeklyTargetsToPlayers`) with per-player outcomes  
- Admin Player Mapping UI (`PlayerMappingModal` on `/admin/planner`)  
- Multi-player Daily Target apply orchestration (`applyDailyTargetToPlayers`) with per-player outcomes  
- Weekly Planner UX finalized (status/order helpers, humanized progress statuses, coach-facing outcomes)  
- Phase E Daily Plan printable sheet: Admin-only browser print at `/admin/planner/daily-plan`
- Daily Plan final redesign: A4 landscape; red accents; dominant player table; secondary Weekly % / Daily % / Daily Team Average summaries
- Daily Plan is **read-only** (no DB writes); source = existing Daily Target absolutes via frozen Match Best × Daily %
- Daily Plan content: Week / MD Tag / Player / absolute TD·HSR·Sprint·Acc·Dec + secondary shared-% / team-average projections — **no** Actual, Difference, Match Best values, To Target, Remaining, mapping, Wellness/RPE

### Verification baseline (after Power BI query modules)

- ESLint / TypeScript / Vitest re-verified after each approved phase  

### Not implemented yet

- Carry-over / microdosing / automatic coaching  

### Next phase (requires explicit approval)

No further GPS Load Planner V1 feature phase is open.  
Carry-over / microdosing / automatic coaching remain excluded unless explicitly re-approved.

---

## Agent / ownership model

- **Main Cursor Agent** = Lead / Integrator  
- Project subagents under `.cursor/agents/` provide scoped analysis, implementation drafts, and review  
- Parent/Main Agent owns final integration decisions  
- Do not run multiple agents concurrently on the same migration/file/module  
- Database migrations and security changes: sequential + reviewed before proceeding  

---

*End of authoritative V1 specification.*
