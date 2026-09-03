# ST-AMS GPS Load Planner — Master Specification

**Status:** Authoritative project specification  
**Scope:** GPS Load Planner production architecture (Training planner + Two-Match Week V2)  
**Last architecture lock:** `TWO-MATCH WEEK V2: PRODUCTION READY` (`c09958c`) on `/admin/planner`

This document is the **single source of truth** for GPS Load Planner.  
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

GPS Load Planner is **ADMIN ONLY** for the **entire** feature.

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

Persistent Week Squad (§J2) is **not** a team, season, or club roster.  
It is only week-scoped Planner membership / default working selection for one `planner_weeks` row.

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
| Match Best | `getMatchBestGps(...)` — `lib/powerbi/queries/matchBest.server.ts` (`Match_Benchmark` only; see §F; History is Power BI-only §F2) |

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
- `Date` — the planner day’s explicit ISO `YYYY-MM-DD` (not server “today”)
- `Drill` — dated contract (`INDIVIDUAL_TRAINING_START_DATE = "2026-09-01"`):
  - `date < 2026-09-01` → exactly `"Full Training"`
  - `date >= 2026-09-01` → exactly `"Full Training"` **or** `"Individual"` (`GPS_Log[Drill] IN {"Full Training", "Individual"}`)

ST-AMS queries `GPS_Log` directly. Do **NOT** use `Training_Drill_Switch`, `SourceFile`, `Top Up`, `SessionType = "Individual"`, or case/alias variants (`"individual"`, trailing spaces).

Primary production filtering uses these **dedicated columns**.  
Do **NOT** use `SourceFile` parsing as the primary production strategy.

**Row behavior (per player × planner day, exact drill strings):**

| Full Training rows | Individual rows | Result |
| ---: | ---: | --- |
| 0 | 0 | `not_found` |
| 1 | 0 | success using Full Training |
| 0 | 1 | success using Individual (only when `date >= 2026-09-01`; earlier dates never query Individual) |
| 1 | 1 | `ambiguous` |
| >1 | any | `ambiguous` |
| any | >1 | `ambiguous` |

**NEVER** silently `SUM` / `MAX` / `MIN` duplicate rows of the same drill.

**NEVER** sum Full Training + Individual. **NEVER** apply precedence between them.

Missing data is `not_found` / `—`, never zero-filled.

---

## F. Match Best — verified mapping

### F1. `Match_Benchmark` (CURRENT / latest — ST-AMS source)

**Purpose:** Current / latest Match Best values per player.

**ST-AMS query:** `getMatchBestGps` — `lib/powerbi/queries/matchBest.server.ts`  
Filter: `Match_Benchmark[Method] = "single-match best"`.

| Concept | Field | ST-AMS mapping |
|---|---|---|
| Player | `Match_Benchmark[Player]` | — |
| Method | `Match_Benchmark[Method]` | required `"single-match best"` |
| TD Best | `Max TD` | `tdBest` |
| HSR Best | `Max Z5` | `hsrBest` |
| Sprint Best | `Max Z6` | `sprintBest` |
| Acc Best | `Max Acc` | `accBest` |
| Dec Best | `Max Dec` | `decBest` |

- Do **NOT** calculate Match Best in ST-AMS.
- Different metric bests may originate from different matches.
- Planner reference = **single-match best per metric**.
- Do **NOT** use Top-3 average or rolling benchmark.
- Do **NOT** change this integration because of History (below).

### F2. `Match_Benchmark_History` (Power BI reporting / history ONLY)

**Purpose:** Historical benchmark versions for **Power BI percentage measures** (`TD %`, `HSR %`, `Sprint %`, `Acc %`, `Dec %`) so old sessions/matches do not change when a player later achieves a new Match Best.

**Columns:**

| Column | Role |
|---|---|
| `Player` | Player identity |
| `Valid_From` | Date from which this benchmark version is active |
| `Best_TD` | Historical TD best |
| `Best_Z5` | Historical HSR best |
| `Best_Z6` | Historical Sprint best |
| `Best_Acc` | Historical Acc best |
| `Best_Dec` | Historical Dec best |

**Lookup (Power BI, per player + session/match date):**

1. Find the latest History row where `Valid_From <= session date`.
2. Use that row’s five benchmark values.
3. Compute the percentage against that historical benchmark.

**Validated example (Power BI):** Gustavo Cascardo prior HSR best 725 m; match 2026-08-10 actual 733 m → 101%. After adding a temporary History row from 2026-08-11 with HSR best 1000 m, the 2026-08-10 match remained 101%.

**Explicit ST-AMS rule:** `Match_Benchmark_History` is **NOT** an ST-AMS data source. It is **not** queried by `getMatchBestGps`, the Power BI connector mappings used by the planner, or any planner snapshot / Actual path. Do **not** wire ST-AMS to History unless a future approved phase explicitly requires it.

### F3. Operational workflow — new Match Best

Example: Matei Cosmin `Max Z5 = 797` → new HSR Match Best `850`.

**`Match_Benchmark` (current state):**

- Do **NOT** add another row.
- **Update** the existing player row in place (`797 → 850`).
- Table always represents the latest/current state only.

**`Match_Benchmark_History` (append-only):**

- Do **NOT** modify or delete old historical rows (operationally immutable).
- **Add ONE new full row** with all five current benchmark values, even if only one metric changed:

`Player | Valid_From | Best_TD | Best_Z5 | Best_Z6 | Best_Acc | Best_Dec`

Example:

- Old: `Matei Cosmin | 2026-01-05 | 11472 | 797 | 231 | 106 | 111`
- New: `Matei Cosmin | 2026-08-17 | 11472 | 850 | 231 | 106 | 111`

**`Valid_From`:** defines when the new benchmark becomes active for Power BI historical % calculations.  
**Current convention:** if the new Match Best was achieved in a match, the new benchmark becomes effective from the **following day**.

### F4. ST-AMS planner behavior (unchanged)

```
Match_Benchmark
→ getMatchBestGps
→ current Match Best values
→ frozen planner snapshot
→ planner_match_best_snapshots
```

- Existing planner weeks remain immutable when `Match_Benchmark` is updated later (see §L).
- Do **not** modify `getMatchBestGps`, snapshot logic, planner schema, connector mappings, RLS, migrations, or API endpoints because of `Match_Benchmark_History`.

---

## G. Planner metrics — locked

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

Number of official Matches (0 / 1 / 2) is **independent** of Week Type.  

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

Groups do **not** define saved week squad membership.  
Do **not** reuse `planner_group_members` as the persisted week squad.  
See **§J2**.

---

## J2. Persistent Week Squad

**Status:** approved product contract (documentation). Implementation requires a later explicit phase.  
**Scope:** week-scoped Planner membership / default working squad only.

This is **NOT**:

- a season model
- a team / club roster
- a general ST-AMS player-membership system
- an owner of Weekly Targets, Daily Targets, or Match Best snapshots
- a replacement for Groups

It is **only**:

```text
one planner week
→ persisted default Planning squad
→ temporary working selection may differ until Save Squad
```

### J2.1 Saved squad vs working selection

Two separate concepts:

| Concept | Meaning |
|---|---|
| `savedSquadPlayerIds` | Persisted membership for the selected planner week |
| `selectedPlayerIds` | Temporary current UI working selection |

On week load:

```text
savedSquadPlayerIds = persisted week squad
selectedPlayerIds   = copy of that saved squad
```

Checkbox / Select all / Clear / Group “Select members”:

- modify **only** `selectedPlayerIds`
- do **not** persist automatically
- do **not** create or delete targets or snapshots
- do **not** call Power BI
- do **not** freeze Match Best

Only explicit **Save Squad** changes saved week membership.

### J2.2 Week switch

When the Planning planner week changes:

- load **that** week’s saved squad
- initialize `selectedPlayerIds` from that saved squad
- reset unsaved squad-change UI state (dirty count, apply-plan prompt)

Do **not** carry the previous week’s working selection into the new week.

### J2.3 Save Squad

Explicit Save Squad diff:

| Working selection vs saved | Effect |
|---|---|
| newly selected | INSERT membership |
| still selected | no-op |
| previously saved, now unselected | DELETE membership row **only** |

Save Squad alone:

- persists membership
- requires **no** Power BI
- does **not** invent percentages
- does **not** automatically create Weekly / Daily Targets
- does **not** freeze Match Best
- does **not** delete targets or snapshots

### J2.4 Reset to saved squad

Secondary action: **Reset to saved squad**.

- restores current `selectedPlayerIds` from persisted membership
- writes nothing
- preserves temporary-subset workflows

### J2.5 Temporary subsets remain supported

Example: saved W6 squad = 20 players. Admin temporarily selects 7, then uses **Apply this day only** or Daily Plan.

That temporary 7-player selection must **not** modify the saved squad.

Saved squad changes only through explicit **Save Squad**.

### J2.6 Membership does not own targets

Saved squad membership is independent from:

- `planner_weekly_targets`
- `planner_daily_targets`
- `planner_match_best_snapshots`

Removing a player from the saved squad must **not** automatically delete:

- Weekly Target
- Daily Targets
- frozen Match Best snapshot
- historical Review / Total Load rows derived from those targets

No target or snapshot FK may depend on membership.

### J2.7 Planning vs Review / Daily Plan population (LOCKED)

| Surface | Population |
|---|---|
| Planning available player list | all eligible player profiles (`profiles` where `role = 'player'`) |
| Planning default checkboxes | saved week squad |
| Weekly Review | players with a saved Weekly Target for that week |
| Daily Review | same Weekly Target population |
| Total Load | same Weekly Target population (§U3.1) |
| Daily Plan | current working `selectedPlayerIds` |

Do **not** filter Review or Total Load by saved squad membership.

Reason: removing someone from the active Planning squad must not make historical planned/actual data appear deleted.

### J2.8 Groups remain selection helpers

Groups remain week-scoped optional **selection helpers** only (§J).

Groups do **not** define:

- saved squad
- reusable plans
- Weekly Targets
- Daily Targets
- Match Best snapshots

### J2.9 Persistence model

Approved minimal table concept (not created in this documentation phase):

`planner_week_players`

| Rule | Value |
|---|---|
| PRIMARY KEY | `(week_id, player_id)` |
| Meaning | row exists = player is in that week’s saved squad |
| Week delete | membership rows removed |
| Membership delete | targets and snapshots **unaffected** |
| Access | ADMIN ONLY |

Do **not** add:

- `active` boolean
- sort order
- target ownership
- plan ownership
- historical membership versions

Expected RLS when implemented:

- Admin: SELECT / INSERT / DELETE
- No UPDATE (membership rows have no mutable state)
- Staff / Player / anon: none
- No service-role normal CRUD

### J2.10 Legacy-week backfill

Existing planner weeks must **not** open with an empty saved squad after rollout if Weekly Targets already exist.

Approved backfill source:

```text
DISTINCT player_id
FROM planner_weekly_targets
for each planner week
```

Do **not** backfill from:

- all profiles
- groups
- snapshots-only

Example: a week with 19 Weekly Targets → initial saved squad = those 19 players.  
A draft week with no Weekly Targets → initial saved squad empty.

### J2.11 New players after Save Squad

Save Squad saves membership **first**.

If genuinely **new** players were added (not already in the previous saved squad, and not returning players who already have this week’s targets), the system **may then offer**:

`Apply existing plan?`

That offer is a **separate explicit action**.

Do **not** automatically create targets during Save Squad.

### J2.12 Returning player

If a player previously had Weekly/Daily Targets in this week, was removed from the saved squad, and is later added back:

- re-add membership **only**
- do **not** automatically apply another player’s plan
- do **not** overwrite their existing targets

They may be shown as `Already has targets` (or equivalent).

### J2.13 Complete reusable plan

Groups do **not** define plans.

A complete reusable plan is derived only from persisted percentages of **current saved-squad players**.

A player contributes one reusable plan only if:

1. Weekly Target exists  
2. Daily Target exists for **every current** Training day (`planner_week_days`)

Signature — compare **exact stored** numerical values (no display rounding, no averages):

```text
Weekly: TD % · HSR % · Sprint % · Acc % · Dec %
Daily:  for each current planner_week_day:
        TD % · HSR % · Sprint % · Acc % · Dec %
```

Match rows never participate.

### J2.14 Incomplete / no / one / multiple plans

**Incomplete:** Weekly-only, or missing Daily Target on any current Training day → **not** a complete reusable plan. Do not offer it as a complete template. Do not silently copy partial plans.

**No complete plan:** Save Squad succeeds. Do **not** show `Apply existing plan?`. Admin configures Weekly/Daily Targets normally afterward.

**Exactly one complete plan:** after Save Squad, offer:

`Apply existing plan to <new player names>?`

Admin may Apply or Skip / No plan. Explicit approval required.

**Multiple distinct complete plans:** do **not** guess. Offer choices from persisted target signatures. Do not invent Group ownership. No artificial Plan A/B database object is required in V1.

Small understandable representation may include player count, Weekly 5 %, and Daily coverage. Example:

```text
14 players · Weekly 135 / 140 / 120 / 130 / 130 · Daily 5/5
```

### J2.15 Multiple new players (V1)

One selected plan (or No plan) for **all** genuinely new players together.

Do **not** build a per-player wizard in V1.

### J2.16 Apply existing plan — percentages only

When Admin **explicitly** applies an existing plan:

- copy **only** persisted percentages
- never copy the source player’s absolute TD / HSR / Sprint / Acc / Dec

```text
NEW player Weekly absolute = that player's frozen Match Best × copied Weekly % / 100
NEW player Daily absolute  = that player's frozen Match Best × copied Daily % / 100
```

Use existing trusted Weekly/Daily target create paths.

If the new player has no snapshot: player mapping → Power BI Match Best → freeze **that player’s own** Match Best → Weekly Target. Existing Weekly Target create behavior remains authoritative.

Do **not** create a shared group snapshot.  
Do **not** use another player’s Best.

### J2.17 Apply only to genuinely new target players

Do **not** run existing batch Apply over returning / already-targeted players merely because they were added back to the saved squad.

Existing apply functions can **UPDATE** targets.

Apply Existing Plan must target only players who genuinely require **new** target creation. Returning players keep their own existing targets.

### J2.18 Partial failure

Membership save and target apply are **separate**.

If membership Save succeeds but optional Apply Existing Plan fails (mapping missing, Power BI Match Best missing, Weekly Target create fails, Daily apply partially fails):

- membership remains saved
- Admin receives clear per-player failure / outcome information

Do **not** roll back valid membership because optional target application failed.  
No silent failure.

### J2.19 Power BI

| Action | Power BI |
|---|---|
| Save Squad | **NO** |
| Remove player from squad | **NO** |
| Add membership only | **NO** |
| Reset to saved squad | **NO** |
| Apply Existing Plan when the new player lacks a frozen snapshot | existing Weekly Target Match Best path only |

### J2.20 Protected systems

Persistent Week Squad must **not** change:

- Weekly / Daily formulas
- frozen Match Best semantics
- Match Actual / Extra Time
- Two-Match
- Total Load calculations
- Weekly Review / Daily Review calculations
- Daily Plan calculations
- Remaining
- Power BI semantic model
- Groups ownership
- Admin-only Planner access

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
- Do **NOT** overwrite when Power BI Match Best changes (`Match_Benchmark` updates).  
- `Match_Benchmark_History` is irrelevant to snapshots — ST-AMS never reads it (§F2–F4).  

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
- do **NOT** make `(week_id, md_tag)` unique (two-match weeks may reuse MD tags)  
- Training days **only** — Match rows are **not** stored here  

Also: `UNIQUE (id, week_id)` to enable composite FKs from daily targets.

Weekly Target, Daily Target, Remaining to Allocate, Weekly Review, Daily Review, and Daily Plan all use `planner_week_days` only. Match rows do not receive Daily Target %, planned absolutes, Remaining, Training completeness, Daily Review Training days, or Daily Plan targets.

---

## N2. Official matches and combined week structure

A Planner week may have **0, 1, or 2** configured official Matches.

| Store | Meaning |
|---|---|
| `planner_week_days` | Training days only |
| `planner_week_official_matches` | Match identity / display metadata only (no GPS Actuals) |

These remain **separate stores**. Combined weekly structure is **UI / read-model only** — do not persist the merged array, and do not feed it into Daily % / Remaining / write paths.

**Create/Edit Week** is the **only** user-visible Match identity editor. Supports 0 / 1 / 2 Matches. Date and mdTag are typed manually. No Planned Match Date. No automatic fixture inference. No automatic MD1 / MD2 / M1+1 / M2-3 generation. Both matches may use `md_tag = MD`. Match 1 cannot be removed while Match 2 exists. Match 2 is deleted by row ID.

The Planning week-days UI merges Training + Match rows **chronologically for display**. Example:

```text
18 Aug | MD-1 | Training
19 Aug | MD   | Match 1
20 Aug | MD+1 | Training
22 Aug | MD-1 | Training
23 Aug | MD   | Match 2
```

Stored mdTag is unchanged. Match cards show Match 1 / Match 2 context. Match rows have no TD/HSR/Sprint/Acc/Dec inputs, no planned absolutes, no Daily Target mutation, and no Daily Plan action.

Same Planner week + same date **cannot** be both Training and Match. Protected by application validation and DB triggers (migration `045`). Match `gps_date` **may** fall outside `planner_weeks.start_date`..`end_date` (verified: W5 Training `2026-08-11`→`2026-08-14`, Match `2026-08-15`).

Singular V1 compatibility APIs remain internally. New Create/Edit Week UI uses row-safe multi-match APIs. Legacy functions are **not** the current multi-match UI workflow. Do not delete them as a cleanup.

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
- Daily Actual = Power BI Training Actual via `getTrainingActualGps` (Planning / Daily Analysis) using the dated Full Training / Individual drill contract (§E)
- Weekly Actual = sum of elapsed Daily Actuals  
- Do **not** include the game in weekly training Actual  

Total Load Match Actual is a **separate** live Power BI query (see **§U3**).  
It must **not** be merged into Weekly/Daily Training Actual or into `getTrainingActualGps`.  
Do **not** persist GPS Actual metrics.

**Weekly Review loading (implementation detail):** day-batched Training Actual queries
(`getTrainingActualGpsBatchForDay` / `getPlannerWeeklyReviewProgress`) — one Execute Queries  
call per included Week Day for all frozen player names — for reliability/performance.  
Per-player **0 / 1 / >1** raw-row quality semantics are preserved (no SUM/MAX aggregation that  
hides duplicates). Planning focused-player Weekly Progress may keep using single-player  
`getTrainingActualGps`.

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

## U2. Planning | Review navigation (Phase F)

Single Admin route:

`/admin/planner`

Top-level segmented control (only one visible at a time):

`Planning | Review`

**Planning:** existing Weekly Planner. Kept mounted/hidden when Review is active. Default checkbox population follows Persistent Week Squad (§J2) once implemented; Weekly / Daily / Match formulas are unchanged.

**Review:** secondary segmented control `Weekly | Daily | Total Load`.

**Weekly and Daily** behavior, loaders, calculations, compliance colors, and print remain **Training-only** and **completely unchanged** by Match rows. Total Load is an additional Review tab (**§U3**, production implemented).

- Week selector: any saved `planner_weeks` (including closed/historical)
- Planning available player list: all eligible player profiles
- Planning default working selection: saved week squad (§J2)
- Daily Plan population: current working `selectedPlayerIds` (not Review population)
- Review population: players with a saved Weekly Target for that week — **not** filtered by saved squad
- Total Load population: same Weekly Target population (§U3.1) — **not** filtered by saved squad
- Weekly / Daily Actual: live Power BI Training Actual only (dated Full Training / Individual contract, §E) — **not** persisted
- Historical Actual identity: frozen snapshot `powerbi_player_name` (never current mapping)
- Metrics: TD / HSR / Sprint / Acc / Dec only
- Sign: Planned − Actual (Weekly: To Target; Daily: Difference)
- Weekly uses day-batched `getPlannerWeeklyReviewProgress` + visible `throughDate` (≈1 Power BI call per included Week Day; Planning focused Progress may still use `getPlannerWeeklyProgress`)
- Daily Review uses day-batched `getPlannerDailyReviewAnalysis` + dynamic `planner_week_days` (≈1 Power BI call for the selected Week Day; single-player `getPlannerDailyAnalysis` remains available)
- Missing Daily Target: Planned/Difference `—`; Actual may still show if found
- Missing / ambiguous / error Actual: never fake zeros; withhold Difference/To Target per existing domain
- No new archive/history tables; no new sidebar route; no automatic coaching

**Review UI state (session/page only):** Owned by `GpsLoadPlannerView` shell. Switching Planning ↔ Review preserves Review sub-tab (`Weekly` / `Daily` / `Total Load`), Review week, through-date, and Daily week-day selection. First open of Review may seed week from Planning; later switches do not overwrite Review selections. Intentional Review week change revalidates through-date for the new week range and replaces a stale Daily week-day with a valid day from the new week. Official Match identity is persisted on `planner_week_official_matches` and edited only in Create/Edit Week (see §N2 / §U3). Total Load Match cards are **read-only**.

**Weekly Review Power BI loading:** Day-batched Execute Queries (one call per included Week Day for all frozen names) with bounded transient retry. Do not treat day-batching as a business-rule change — 0/1/>1 row quality and completeness contracts are unchanged.

**Daily Review Power BI loading:** Day-batched Execute Queries (one call for the selected Week Day for all frozen Review player names) reusing `getTrainingActualGpsBatchForDay` with the same bounded transient retry. Per-player 0/1/>1 classification, Planned / Difference, and Daily compliance colors are unchanged.

---

## U3. Total Load (Review) — PRODUCTION IMPLEMENTED

Admin Review tab **Total Load**. Purpose: show recorded weekly external load.

```text
Recorded Training Load
+
Recorded Match Load (0, 1, or 2 configured Matches)
=
Total Weekly Load
```

Metrics only: TD, HSR (`Z5`), Sprint (`Z6`), Acc, Dec.  
**Z4 / Tempo is OUT of Total Load.**

Do **not** change Planning formulas, Daily Plan, Matchday Report, `Match_Benchmark`, or `Match_Benchmark_History`. Training Actual follows the dated Full Training / Individual contract in **§E**.

### U3.1 Population and identity

All players with a saved Weekly Target for the selected Planner week — **not** only players in the match GPS file, and **not** filtered by Persistent Week Squad membership (§J2).

Players with no match GPS, part of the week’s training, or both remain visible.

Historical identity: frozen `planner_match_best_snapshots.powerbi_player_name`.

### U3.2 Training Actual

Reuse existing Weekly Review Training Actual source (`GPS_Log`, dated drill contract §E).

- Training remains **completely separate** from Match Actual.  
- Do **not** weaken Match Actual filters. Training Actual drill follows §E (Individual from planner-day `2026-09-01`; never sum; never precedence).
- Total Load uses **all persisted `planner_week_days`** for that week (not the Weekly Review `throughDate` picker).  
- Existing Weekly Review completeness / data-quality contract is the Training source of truth.  
- Missing Training day **≠** Training zero. Never invent Training zeros.

**Complete Training** (`actualCompleteness = complete`): use Training Actual normally.

**Partial Training** (`actualCompleteness = partial_not_found` **and** a valid numeric recorded Training Actual exists):

- **KEEP** that recorded numeric Training Actual  
- add valid Match Actual (all configured Matches must be safe)  
- **show numeric Total Week and Total Week %**  
- label quality **`Partial`**  
- do **not** convert missing Training days to zero  
- do **not** hide this recorded load  
- do **not** replace it with `—`

`Partial` means: Total is calculated from GPS load actually recorded for the player, but not every Planner Week Day has a trusted Training Actual row.

Example: player recorded Training Actual only on two week days (MD-4 = 4,500 m, MD-3 = 6,000 m) and has no Training Actual row on the remaining Planner days. Recorded Training Load = 10,500 m. If Match Load = 5,000 m, Total Weekly Load = **15,500 m** and **must be shown** (labelled Partial; eligible for Top Values). Missing Training days stay omitted, not zeroed.

**Unsafe Training** (ambiguous raw data, query error, invalid/incomplete payload, or any existing state where the numeric value cannot be trusted):

- Total Week = `—`  
- Total Week % = `—`  
- Top Values eligibility = **NO**  
- Do not invent values. Do not treat unsafe Training as zero.

### U3.3 Official Match configuration (Create/Edit Week)

**Create/Edit Week** is the only user-visible Match identity editor. Total Load does **not** Change / Clear / pick a match date.

A Planner week supports **0, 1, or 2** official Matches in `planner_week_official_matches` (see §N2 / §X). Persist identity / display metadata only. **Do not persist GPS Actual metrics.**

Do **not** auto-resolve from `planner_weeks.start_date` / `end_date`.  
Verified reason: W5 `end_date` = 2026-08-14; official Team match GPS date = 2026-08-15.

Required per Match: `gps_date`, `md_tag` (manual).  
Optional: `opponent`, `matchday`, `competition`.  
Both matches may use `md_tag = MD`. Date distinguishes Match 1 / Match 2. No automatic MD1 / MD2.

| Persisted | Role |
|---|---|
| `gps_date` | Runtime `GPS_Log[Date]` query key |
| `match_order` | Slot 1 or 2 |
| `md_tag` | Display / context (not unique; not a Power BI MD1/MD2) |
| `opponent` | Frozen display at Admin save (nullable) |
| `matchday` | Frozen display at Admin save (nullable) |
| `competition` | Frozen display at Admin save (nullable) |

Do **not** require `gps_date` inside the Planner week date range.  
Do **not** auto-rewrite historical headers if Power BI `Match_Info` later changes.

**0 configured Matches:** quality `match_not_selected`. Final Total Week / % unavailable. Training may still exist as a component but must **not** be labelled Total Week. This is **not** `match_zero`.

### U3.4 Match source availability and Match Actual

Power BI semantic model is **unchanged**. Live `GPS_Log`. ST-AMS reads the semantic model / `GPS_Log` only — **not** Matchday Report pages. Exact filters:

- `Player` IN frozen Planner Power BI names  
- `Week ID` = that week’s `powerbi_week_id`  
- `Date` = that Match’s `gps_date`  
- `MD_Tag` = `"MD"`  
- `SessionType` = `"Team"`  
- `Drill` IN the **strict allowlist** only:

```text
"1st Half"
"2nd Half"
"1st Half Extra Time"
"2nd Half Extra Time"
```

Exact strings (spelling, spaces, capitalization). Do **not** normalize or rename.

Extra Time segments (`"1st Half Extra Time"`, `"2nd Half Extra Time"`) are **optional**. Their absence must **not** change regulation-only Match behavior: a match with only `"1st Half"` / `"2nd Half"` remains valid and identical to the previous two-half contract.

This allowlist is **generic** for every configured Match in every week. Detection comes only from trusted `GPS_Log` rows for the exact configured Match key (week ID + `gps_date` + the filters above). **No** week-specific rule. **No** date / opponent / competition / match-order hardcode. **No** manual Extra Time YES/NO toggle.

The candidate / source-availability query uses the **same four-string allowlist**. Other candidate/source-gate semantics are unchanged.

Date distinguishes Match 1 / Match 2. Each configured Match is evaluated independently by exact `gps_date`. Segments must **not** leak across configured Match dates.

Do **not** use `SourceFile` as primary identity.  
Do **not** use `Match_Info` as a Match Actual filter.  
Do **not** use report pages.  
Do **not** use `SessionType = "Individual"`, `Drill = "Individual"`, or training drills `"First Half"` / `"Second Half"`.  
Do **not** use aggregate / total-like Drills (`Full Match`, `Match Total`, `90 Min`, `120 Min`, or any future equivalent). Those remain excluded unless this spec is explicitly changed again.

Maximum Match-path queries per Total Load load:

```text
1 candidate / source-availability query
+
0–2 Match Actual batch queries (only for dates proven in the Team MD candidate set)
```

No player-by-player query loop. Parallel Match Actual module — **do not weaken** the Match allowlist. Training Actual follows **§E**.

Reuse: Power BI auth, `executePowerBiDaxQuery`, bounded retry, DAX escaping, raw-row safety, existing `getMatchCandidateDates` + `getMatchActualGpsBatch`.

**Configured Match date missing** from the Power BI Team MD candidate set:

- quality = `match_data_pending`  
- **not** `match_zero`, **not** DNP, **not** `data_issue`  
- Final Total Week / % unavailable  
- Available Training / other Match components may remain visible internally  
- Do **not** label Training + Match 1 as final Total when Match 2 is pending  

Candidate / batch failure → unsafe (`match_query_error` / equivalent). Final Total unavailable.

### U3.5 Match raw-row contract (per player, per allowlisted segment)

Cardinality is per **player × configured match × allowlisted segment**.

| Rows | Result |
|---|---|
| 0 | segment absent |
| 1 valid | use the segment exactly once |
| 1 malformed | `data_issue` / unsafe (existing contract) |
| >1 | ambiguous / Data issue (`match_ambiguous`) |

**Never** SUM / MAX / MIN duplicates, choose first row, or hide ambiguity.

If **any** allowlisted segment is `>1`:

- that Match is unsafe (`match_ambiguous`)  
- Match Time = `—`  
- that player’s Final Total Week / % = `—`  
- Top Values eligibility = **NO**  
- Do **not** present a partial safe-match sum as Final Total  

### U3.6 Match aggregation and Match zero

If cardinality is safe:

```text
Match Actual = sum of every VALID allowlisted segment PRESENT
for that player on that exact configured Match date
```

Eligible segments (allowlist only):

- `"1st Half"`
- `"2nd Half"`
- `"1st Half Extra Time"`
- `"2nd Half Extra Time"`

`match_ok` does **not** require all four segments. Any combination of present valid segments is supported.

Missing Extra Time segment = **absent**. It is **not** a data error, **not** automatically incomplete, and **not** ambiguous.

Examples (behavior only — not week-specific rules):

- Normal 90-minute match: 1st + 2nd present; both ET absent → regulation Match Actual only.
- Player does not play Extra Time: regulation segment(s) present; ET absent → use only that player’s present valid regulation segments.
- Player enters only during Extra Time: regulation may be absent; ET segment(s) valid → use the present valid ET segment(s).

Match Actual must **never** be:

- halves + Full Match
- 90-minute Total + 120-minute Total
- regulation Total + ET-inclusive Total

Only the strict four-segment allowlist is eligible.

`match_zero` is valid **only after** Match source availability is proven **and** the player has **0 rows for all four allowlisted segments**:

- Match quality = `match_zero`  
- Match TD/HSR/Sprint/Acc/Dec = **0**  
- Match Time = `0:00`  

Operational assumption: players who played are normally in the official STATSports **Team** match export. No manual Played list.

**This Match-zero rule must NEVER be copied to missing Training days.**  
Pending source ≠ `match_zero`.

### U3.7 Match Time

Use raw `GPS_Log[Duration]` only.  
Do **not** use Matchday Report `[Session Duration (min)]`.  
Per-Match duration = sum of raw `GPS_Log[Duration]` from that player’s **valid present allowlisted segments** on that `gps_date`. Do **not** hard-code 90 or 120 minutes. Do **not** use a derived scheduled Match length.

```text
1 Match:  Match Time = Match 1 duration
2 Matches: Match Time = Match 1 duration + Match 2 duration
```

Per-Match durations remain available internally. Display as total **minutes:seconds** (not clock hours).  
`match_zero` → `0:00`. Unsafe / unselected / pending → `—`.

Verified examples (reference only; do not hard-code in production): Doru `99:35`; Fabio `88:10`; Raul 2nd-only `34:41`.

### U3.8 Total Week and %

```text
0 Matches:     Final Total unavailable (`match_not_selected`)
1 safe Match:  Total Week = Training + Match 1
2 safe Matches: Total Week = Training + Match 1 + Match 2
Total Week % = Total Week / Frozen 1-Match-Best × 100
```

This Total Load formula is **unchanged**. Extra Time does **not** add a third term: present ET segments are already inside that Match’s Actual (regulation + optional ET). Denominator, frozen 1-Match-Best, Top Values eligibility, Complete / Partial, source gate, and Training Actual stay unchanged.

Denominator: **`planner_match_best_snapshots`** for that week + player (frozen **1-Match-Best**).  
Even during two-match weeks: **no** 2-Match Best, **no** doubled denominator.

**Not** current `Match_Benchmark`, **not** `Match_Benchmark_History`, **not** Weekly Planned, **not** Weekly Target %.

Raw math unrounded; display rounding only. Frozen Best = 0 → Total Week % = `—`.

Partial Training with valid numeric recorded load: use that recorded Training value; do not add artificial zero Training days.

If any configured Match is pending, or any of that player’s Matches is unsafe: Final Total Week / % unavailable. Do not present Training + one safe Match as Final Total.

### U3.9 Total Load quality

| Quality | Training | Match | Total / % | Top Values |
|---|---|---|---|---|
| **Complete** | `complete` | all configured Matches `match_ok` or `match_zero` | numeric | **eligible** |
| **Partial** | `partial_not_found` with valid numeric Training | all configured Matches `match_ok` or `match_zero` | **numeric, labelled Partial** | **eligible** |
| **Pending** | any | any configured Match `match_data_pending` | `—` | no |
| **Unsafe** | ambiguous / error / untrusted | **or** any Match ambiguous / query error / data issue | `—` | no |
| **Match not selected** | any | 0 configured Matches | Total `—` (do not label Training as Total Week) | no |

Partial rows **display** recorded Total and **are eligible** for Top Values (same absolute ranking as Complete). Missing Training days still cannot prove non-participation vs missing GPS; Most cards must match the highest displayed Total. Pending / unsafe / match-not-selected remain excluded.

### U3.10 No Total Load compliance colors

Descriptive exposure only. **No** green / orange / red, target tolerance, or injury-risk classification.  
Weekly and Daily compliance colors remain unchanged.

### U3.11 Header, table, Top Values

Header: Week; Training date range; read-only Configured Matches (date / mdTag / opponent / matchday / competition / source status). Match identity is edited in Create/Edit Week, not on this tab.

Weekly Plan % across the Total Load Weekly Target population, per metric: all same → that %; different → `Mixed`; none → `—`. **Do not average percentages.**

Main table: Player; Match Time; TD Total; TD %; HSR Total; HSR %; Sprint Total; Sprint %; Acc Total; Acc %; Dec Total; Dec %. No colors. Quality must be visible (`Complete` / `Partial` / pending / data issue). Partial keeps numeric Total and %.

Training / Match breakdown: tooltip / compact detail on Total. No extra wide columns. Do not label a pending two-match week as final `Training + Match 1`.

Top Values This Week: Most TD / HSR / Sprint / Acc / Dec. Rank **absolute Total Week**, not %. Eligible quality `Complete` **and** `Partial` when numeric Total exists. Exclude pending, unsafe, unavailable, match not selected. `match_zero` remains eligible if Training is complete or Partial with numeric Total. Tie: higher absolute first; exact tie → player display name ascending.

Do **not** revert Top Values to Complete-only.

### U3.12 Security

Total Load and Match CRUD are **ADMIN ONLY** (UI, actions, RLS).  
`planner_week_official_matches`: RLS enabled; SELECT/INSERT/UPDATE/DELETE for `public.current_user_role() = 'admin'` only. Existing Planner Admin guards. No new service-role application CRUD. Staff and Player: **no** access.

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

## V. Plan compliance colors (Review UI)

Colors = **plan compliance only**.  
Not injury risk, readiness, medical warning, or biological safety.

### Weekly Review (Actual / frozen Match Best × 100)

Display-only classification per **player** and **metric** (does not change Planned/Actual/To Target math):

```text
Actual Weekly % = Weekly Actual absolute / frozen Match Best absolute × 100
```

Compare against **that player's saved Weekly Target %** with dynamic green tolerance:

| Metric | Green band |
|---|---|
| TD | Weekly Target ±20 percentage points |
| HSR | Weekly Target ±20 percentage points |
| Sprint | Weekly Target ±10 percentage points |
| Acc | Weekly Target ±20 percentage points |
| Dec | Weekly Target ±20 percentage points |

- **Green:** inside band inclusive of edges  
- **Orange:** below lower boundary  
- **Red:** above upper boundary  
- **Neutral:** incomplete / partial / ambiguous / unavailable Actual quality (no compliance color)

Example: player TD target 200% → green 180–220%; player TD target 250% → green 230–270%.

Do **not** hard-code example targets (250% / 150% / 100% / 300%) as universal bands.

Legend: Green — Within target range; Orange — Below target range; Red — Above target range.

### Daily Review (Difference = Planned − Actual)

| Metric | Green | Orange | Red |
|---|---|---|---|
| TD | 0–500 | >500 | <0 |
| HSR | 0–100 | >100 | <0 |
| Sprint | 0–50 | >50 | <0 |
| Acc | 0–10 | >10 | <0 |
| Dec | 0–10 | >10 | <0 |

Legend: Green — Within planned tolerance; Orange — Below planned load; Red — Planned load exceeded.

### Total Load

**No compliance colors.** Total Load is descriptive exposure only (§U3.10). Do not apply Weekly or Daily color bands to Total Week or Total Week %.

---

## W. Locked exclusions

Do **not** implement unless explicitly re-approved:

- season model  
- team membership model (a general team / club / season roster — **not** the same as Persistent Week Squad §J2)  
- position-specific targets  
- automatic starter detection  
- automatic top-up / microdosing / carry-over  
- automatic plan revision  
- Original vs Revised history  
- previous-week planner targets  
- automated injury-risk calculations  
- 2-Match Best / doubled Total % denominator  

Two-Match Week V2 (0 / 1 / 2 official Matches, combined week display, plural Total Load) is **production implemented**. Do not revert it to a single-match-only product.

---

## X. Database design — production schema

### Tables

| Table | Purpose |
|---|---|
| `player_external_mappings` | ST-AMS UUID ↔ Power BI player name |
| `planner_weeks` | Microcycle header |
| `planner_week_days` | Dynamic **Training** days only |
| `planner_groups` | Week-scoped selection helpers |
| `planner_group_members` | Group membership |
| `planner_match_best_snapshots` | Frozen 1-Match-Best per week+player |
| `planner_weekly_targets` | Player weekly % targets |
| `planner_daily_targets` | Player daily % targets (Training days only) |
| `planner_week_official_matches` | Admin-configured official Matches (0–2 per week; identity/display only — **no GPS Actuals**) |

All planner entities + mappings: **ADMIN ONLY** (RLS + app).

### Approved Persistent Week Squad table (not created yet)

`planner_week_players` is the approved membership table for §J2. It is **not** in production until an explicit implementation phase creates it.

| Rule | Value |
|---|---|
| Purpose | Week-scoped saved Planning squad (not a team/season roster) |
| PRIMARY KEY | `(week_id, player_id)` |
| Meaning | row exists = player is in that week’s saved squad |
| FKs (when created) | `week_id` → `planner_weeks(id)` ON DELETE CASCADE; `player_id` → `auth.users(id)` ON DELETE CASCADE |
| Must **not** FK | `planner_weekly_targets`, `planner_daily_targets`, `planner_match_best_snapshots` |
| No columns for | `active` flag, sort order, target/plan ownership, membership history |
| RLS | Admin SELECT / INSERT / DELETE only; no UPDATE; no Staff / Player / anon; no service-role normal CRUD |

Do **not** reuse `planner_group_members` for this purpose.

### Official Match constraints (current production)

`planner_week_official_matches`:

- `CHECK (match_order IN (1, 2))`  
- `UNIQUE (week_id, match_order)`  
- `UNIQUE (week_id, gps_date)`  
- FK `week_id` → `planner_weeks(id)` ON DELETE CASCADE  
- required: `gps_date`, `md_tag`  
- optional: `opponent`, `matchday`, `competition`  
- **No CHECK** requiring `gps_date` inside the Planner week date range  
- Do not store GPS Actual metrics, Duration Actual, Match Best, or redundant Power BI Week ID  

The old `UNIQUE (week_id)` one-row-per-week constraint was **removed by migration `045`**. It is **not** the current production constraint.

### Official Match migration history (do not rewrite)

| Migration | Role |
|---|---|
| `043_planner_week_official_matches.sql` | Initial official Match persistence (then one row per week) |
| `044_planner_week_official_matches_v2_prep.sql` | Multi-match schema preparation (`match_order`, `md_tag`; still one row per week) |
| `045_planner_week_official_matches_v2_enable.sql` | Enabled max 2 Match rows; dropped `UNIQUE (week_id)`; added Training/Match same-date collision triggers |

### Collision protection

Same Planner week + same date cannot be both Training (`planner_week_days`) and Match (`planner_week_official_matches`). Protected by application validation **and** DB triggers from `045`.

### Key integrity

- Weekly Target → snapshot composite FK  
- Daily Target → weekly target composite FK **and** week_day+week composite FK  
- Groups week-scoped; targets never FK groups  
- Saved week squad (`planner_week_players`, when created) never owns targets; targets/snapshots never FK membership (§J2)  
- Snapshot metric / name / source fields immutable  
- Training day date inside week range  
- `UNIQUE (week_id, display_order)` on days  
- Match date may be outside the Training week range  

---

## Y. Deletion safety

Deleting a planner week may cascade: days → snapshots → weekly targets → daily targets → groups/members → official Match rows (`planner_week_official_matches`) → saved-squad membership (`planner_week_players`, when created).

Removing a player from the saved week squad must delete **membership only**. It must **not** cascade into snapshots, Weekly Targets, or Daily Targets (§J2).

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
- `getMatchBestGps` implemented (`Match_Benchmark` / `Max *` only; ST-AMS does not consume `Match_Benchmark_History`)  
- Match Benchmark History workflow documented (§F2–F4): Power BI historical `%` via `Valid_From` + `Best_*`; operational append-only History + in-place `Match_Benchmark` updates  
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
- Phase F Planning | Review on `/admin/planner`: Planning = existing Weekly Planner; Review = Weekly/Daily Planned vs Actual via existing progress/analysis domain (frozen historical Power BI identity; Actual not persisted)
- Total Load Review **PRODUCTION IMPLEMENTED** (§U2 / §U3): recorded Training + 0–2 Matches; Create/Edit Week owns Match identity; Partial Training numeric load preserved; no Total Load colors; Top Values = Complete **and** Partial with numeric Total
- Weekly Review Actual loading: day-batched Power BI Execute Queries (≈1 call per included Week Day) with bounded transient retry; preserves per-player 0/1/>1 row-quality and completeness/To Target contracts
- Daily Review Actual loading: day-batched Power BI Execute Queries (≈1 call for the selected Week Day via `getPlannerDailyReviewAnalysis` / `getTrainingActualGpsBatchForDay`); preserves per-player 0/1/>1, Planned/Difference, and Daily compliance contracts
- Migrations `043` / `044` / `045` applied to production (official Match persistence → prep → max 2 rows + collision triggers)
- **`TWO-MATCH WEEK V2: PRODUCTION READY`**
  - 0 / 1 / 2 Match weeks
  - manual Match management in Create/Edit Week
  - Training / Match storage separation
  - combined week structure (UI / read-model only)
  - plural Total Load + `match_data_pending` + source availability gate
  - Training-only Weekly/Daily planning preserved
  - Admin-only security

### Verification baseline (after Power BI query modules)

- ESLint / TypeScript / Vitest re-verified after each approved phase  

### Not implemented yet

- Persistent Week Squad (§J2): approved contract only; table / actions / UI not created  
- Carry-over / microdosing / automatic coaching  

### Next phase (requires explicit approval)

Persistent Week Squad implementation requires a later explicit phase after this spec amendment.  
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
