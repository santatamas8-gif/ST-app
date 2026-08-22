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
- Daily Actual = Power BI Full Training via `getTrainingActualGps` (Planning / Daily Analysis)  
- Weekly Actual = sum of elapsed Daily Actuals  
- Do **not** include the game in weekly training Actual  

Total Load Match Actual is a **separate** live Power BI query (see **§U3**).  
It must **not** be merged into Weekly/Daily Training Actual or into `getTrainingActualGps`.  
Do **not** persist GPS Actual metrics.

**Weekly Review loading (implementation detail):** day-batched Full Training queries  
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

**Planning:** existing Weekly Planner (unchanged production-final behavior). Kept mounted/hidden when Review is active.

**Review:** secondary segmented control `Weekly | Daily | Total Load`.

**Weekly and Daily** behavior, loaders, calculations, compliance colors, and print remain **Training-only** and **completely unchanged** by Match rows. Total Load is an additional Review tab (**§U3**, production implemented).

- Week selector: any saved `planner_weeks` (including closed/historical)
- Review population: players with a saved Weekly Target for that week
- Weekly / Daily Actual: live Power BI Full Training only — **not** persisted
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

Do **not** change Planning, Weekly Review, Daily Review, Daily Plan, Training Actual queries, Matchday Report, `Match_Benchmark`, or `Match_Benchmark_History`.

### U3.1 Population and identity

All players with a saved Weekly Target for the selected Planner week — **not** only players in the match GPS file.

Players with no match GPS, part of the week’s training, or both remain visible.

Historical identity: frozen `planner_match_best_snapshots.powerbi_player_name`.

### U3.2 Training Actual

Reuse existing Weekly Review Full Training source (`GPS_Log`, `Drill = "Full Training"`).

- Training remains **completely separate** from Match Actual.  
- Do **not** change `getTrainingActualGps` / `getTrainingActualGpsBatchForDay` or Weekly Review batching.  
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

`Partial` means: Total is calculated from GPS load actually recorded for the player, but not every Planner Week Day has a Full Training row.

Example: player recorded Full Training only on two week days (MD-4 = 4,500 m, MD-3 = 6,000 m) and has no Full Training row on the remaining Planner days. Recorded Training Load = 10,500 m. If Match Load = 5,000 m, Total Weekly Load = **15,500 m** and **must be shown** (labelled Partial; eligible for Top Values). Missing Training days stay omitted, not zeroed.

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

Power BI semantic model is **unchanged**. Live `GPS_Log`. Exact filters:

- `Player` IN frozen Planner Power BI names  
- `Week ID` = that week’s `powerbi_week_id`  
- `Date` = that Match’s `gps_date`  
- `MD_Tag` = `"MD"`  
- `SessionType` = `"Team"`  
- `Drill` IN `{ "1st Half", "2nd Half" }`  

Exact half strings: `"1st Half"` and `"2nd Half"`. Date distinguishes Match 1 / Match 2.

Do **not** use `SourceFile` as primary identity.  
Do **not** use `SessionType = "Individual"`, `Drill = "Individual"`, or training drills `"First Half"` / `"Second Half"`.

Maximum Match-path queries per Total Load load:

```text
1 candidate / source-availability query
+
0–2 Match Actual batch queries (only for dates proven in the Team MD candidate set)
```

No player-by-player query loop. Parallel Match Actual module — **do not weaken** the Full Training query.

Reuse: Power BI auth, `executePowerBiDaxQuery`, bounded retry, DAX escaping, raw-row safety, existing `getMatchCandidateDates` + `getMatchActualGpsBatch`.

**Configured Match date missing** from the Power BI Team MD candidate set:

- quality = `match_data_pending`  
- **not** `match_zero`, **not** DNP, **not** `data_issue`  
- Final Total Week / % unavailable  
- Available Training / other Match components may remain visible internally  
- Do **not** label Training + Match 1 as final Total when Match 2 is pending  

Candidate / batch failure → unsafe (`match_query_error` / equivalent). Final Total unavailable.

### U3.5 Match raw-row contract (per player, per half)

| Rows | Result |
|---|---|
| 0 | half absent |
| 1 | valid half |
| >1 | ambiguous / Data issue |

**Never** SUM / MAX / MIN duplicates, choose first row, or hide ambiguity.

If **either** half is `>1`:

- that Match is unsafe (`match_ambiguous`)  
- Match Time = `—`  
- that player’s Final Total Week / % = `—`  
- Top Values eligibility = **NO**  
- Do **not** present a partial safe-match sum as Final Total  

### U3.6 Match aggregation and Match zero

If cardinality is safe:

```text
Match Actual = valid 1st Half + valid 2nd Half
```

Supported: 1st only; 2nd only; both; both absent.

`match_zero` is valid **only after** Match source availability is proven **and** the player has 0 first-half rows **and** 0 second-half rows:

- Match quality = `match_zero`  
- Match TD/HSR/Sprint/Acc/Dec = **0**  
- Match Time = `0:00`  

Operational assumption: players who played are normally in the official STATSports **Team** match export. No manual Played list.

**This Match-zero rule must NEVER be copied to missing Training days.**  
Pending source ≠ `match_zero`.

### U3.7 Match Time

Use raw `GPS_Log[Duration]` only.  
Do **not** use Matchday Report `[Session Duration (min)]`.

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
- team membership model  
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
- Snapshot metric / name / source fields immutable  
- Training day date inside week range  
- `UNIQUE (week_id, display_order)` on days  
- Match date may be outside the Training week range  

---

## Y. Deletion safety

Deleting a planner week may cascade: days → snapshots → weekly targets → daily targets → groups/members → official Match rows (`planner_week_official_matches`).

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

- Carry-over / microdosing / automatic coaching  

### Next phase (requires explicit approval)

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
