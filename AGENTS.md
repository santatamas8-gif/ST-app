# ST-AMS — Agent instructions

This repository is the ST-AMS (athlete monitoring) web app: Next.js, Supabase, Expo mobile.

Follow existing project rules under `.cursor/rules/` (roles/responsive UI, Vercel deploy). Prefer minimal, focused changes. Do not modify unrelated features.

---

## ST-AMS GPS Load Planner

**Authoritative specification:** [`docs/GPS_LOAD_PLANNER_MASTER_SPEC.md`](docs/GPS_LOAD_PLANNER_MASTER_SPEC.md)

Any work that touches GPS Load Planner, Power BI GPS queries for the planner, planner schema/RLS, planner UI, Daily Plan print, or related tests **must read that master spec first**.

### Hard rules

1. **Approved business rules must not be changed by an agent.** If a request conflicts with the master spec, stop and report the conflict.
2. **Ambiguities must be reported instead of guessed** (schema names, Power BI fields, auth, FKs, calculations).
3. **GPS Load Planner is ADMIN ONLY** — UI, routes, server actions, and Supabase RLS. Staff and players get no planner or mapping access. Security must not rely on hidden nav alone.
4. **Existing ST-AMS features** (Wellness, RPE, Strength, Recovery, Schedule, auth, etc.) **must not be modified** unless explicitly required for the approved planner phase.
5. Reuse existing Power BI connector and query modules (`lib/powerbi/`, `getTrainingActualGps`, `getMatchBestGps`, `getMatchCandidateDates`, `getMatchActualGpsBatch`). Do not rebuild without explicit need. Total Load Match Actual is a **parallel** query; do **not** weaken Full Training filters. Official Matches are Admin-configured in Create/Edit Week (`planner_week_official_matches`, 0–2 rows); do not auto-resolve from week dates. See master spec **§U3**.
6. Philosophy: **USER DECIDES → SYSTEM CALCULATES → USER INTERPRETS / DECIDES AGAIN.** No automatic coaching, recommendations, top-up, carry-over, or silent plan mutation.

### Lead / Integrator (Main Cursor Agent)

- Acts as **Lead / Integrator** for GPS Load Planner work.
- Reads the master spec, breaks work into controlled phases, delegates narrowly scoped tasks to project subagents under `.cursor/agents/`.
- Reviews subagent output; uses **gps-planner-qa** before accepting a major implementation phase.
- Owns **final integration decisions**.
- Do **not** create nested manager hierarchies.
- Do **not** run multiple agents concurrently on the same migration, file, or module.
- Parallel work only when tasks are genuinely independent and cannot conflict.
- Database migrations and security changes: **sequential**, reviewed before moving on.
- After each implementation phase: ESLint, `tsc --noEmit`, full Vitest, targeted new tests, file change report.

### Project subagents (`.cursor/agents/`)

| Agent | Role |
|---|---|
| `gps-planner-database` | Schema, FKs, RLS, migrations, snapshot immutability |
| `gps-planner-powerbi` | Connector, DAX queries, verified semantic-model fields |
| `gps-planner-logic` | Domain calculations (snapshot × %, allocation, Planned − Actual) |
| `gps-planner-ui` | Admin-only planner UI / routes |
| `gps-planner-print` | Printable Daily Plan (minimal coaching sheet) |
| `gps-planner-qa` | Skeptical QA, security, regression, verification |

Each subagent must read `docs/GPS_LOAD_PLANNER_MASTER_SPEC.md` before performing work.
