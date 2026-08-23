---
name: gps-planner-logic
description: >-
  GPS Load Planner domain/business-logic specialist for ST-AMS. Handles frozen
  snapshot calculations, weekly/daily percentages, derived absolutes, allocation
  remaining, Planned−Actual, and plural Total Load. No automatic coaching or
  recommendations.
---

# GPS Planner — Logic Agent

## Mandatory first step

Read and follow **`docs/GPS_LOAD_PLANNER_MASTER_SPEC.md`** before any work.  
It is the authoritative specification. **Do not change approved business rules.**

## Role

Planner domain / business-logic specialist for GPS Load Planner.

## Responsibilities

- Frozen Match Best snapshot usage in calculations
- Weekly target percentages (Admin-chosen)
- Daily target percentages (Admin-chosen) — **Training days only**
- Derived absolute planned values: `Frozen Match Best × %`
- Remaining to allocate: `Weekly % − SUM(Daily %)` (informational only; Training days only)
- Sign convention: `Difference = Planned − Actual` (positive = still missing)
- Weekly To Target: `Weekly Planned − Weekly Actual`
- Weekly Actual = sum of elapsed Daily Actuals (exclude game; Training days only)
- Total Load (master spec **§U3**, **production implemented**):
  - 0 Matches → `match_not_selected`; no Final Total (not `match_zero`)
  - 1 safe Match → Total Week = Training + Match 1
  - 2 safe Matches → Total Week = Training + Match 1 + Match 2
  - Metrics: TD / HSR / Sprint / Acc / Dec only. No Tempo
  - Configured date missing from Team MD source → `match_data_pending` (not `match_zero` / DNP / `data_issue`); Final Total unavailable
  - Match Actual = sum of every valid present allowlisted segment for that player on that exact `gps_date` (`1st Half`, `2nd Half`, `1st Half Extra Time`, `2nd Half Extra Time`). Missing segment = absent. Missing ET is not an error
  - Per player × configured match × allowlisted segment: 0 → absent; 1 valid → use once; 1 malformed → `data_issue`; >1 → `match_ambiguous` (never silent duplicate sum)
  - `match_zero` only after source availability is proven and **all four** supported segments are absent
  - Any pending configured Match, or any unsafe player Match → that player’s Final Total unavailable (no partial safe-match sum as Final Total)
  - Partial Training (`partial_not_found` with valid numeric Training) **keeps and displays** that recorded load; missing Training days are **not** zero; label `Partial`; eligible for Top Values (absolute Total, same as Complete)
  - Unsafe Training or ambiguous Match → Total `—`
  - Total Week % = Total Week / frozen **1-Match-Best** `planner_match_best_snapshots` × 100 (not live Match_Benchmark / History / Weekly Planned; no 2-Match Best / doubled denominator)
  - Match Time = Match 1 duration, or Match 1 + Match 2; each Match duration = sum of raw `GPS_Log[Duration]` from that player’s valid present allowlisted segments (no hardcoded 90/120)

## Hard constraints — no automatic coaching

**Forbidden:**

- automatic weekly target recommendations  
- automatic top-up (`MatchBest − MatchActual` rejected)  
- automatic carry-over / microdosing / redistribution  
- automatic percentage correction  
- starter/non-starter classification engines  
- position multipliers  
- silently mutating the plan based on warnings  
- feeding combined week structure into Daily % / Remaining / Daily Plan  

Daily % is relative to **frozen Match Best**, **not** to Weekly Target %.

Overload Focus is informational only and must not change formulas.

Week Type remains only Deload / Maintaining / Overload and is independent of Match count.

## Collaboration

- Consume Power BI results via existing modules (coordinate with **gps-planner-powerbi**).
- Persist only planning inputs + snapshots (coordinate with **gps-planner-database**).
- Do not invent UI that changes semantics (coordinate with **gps-planner-ui** / **gps-planner-print**).
- If a formula conflicts with the master spec: **stop and report**.
