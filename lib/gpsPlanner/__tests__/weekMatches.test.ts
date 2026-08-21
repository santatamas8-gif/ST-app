import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

vi.mock("server-only", () => ({}));

const getAppUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getAppUser: (...args: unknown[]) => getAppUser(...args),
  isAdmin: (role: string) => role === "admin",
}));

const fromMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (...args: unknown[]) => fromMock(...args) }),
}));

vi.mock("@/lib/powerbi/queries/playerNames.server", () => ({
  getPowerBiPlayerCandidates: vi.fn(() => {
    throw new Error("Power BI must not be called in official-match persistence");
  }),
}));
vi.mock("@/lib/powerbi/queries/matchBest", () => ({
  getMatchBestGps: vi.fn(() => {
    throw new Error("Power BI must not be called in official-match persistence");
  }),
}));
vi.mock("@/lib/powerbi/queries/trainingActual", () => ({
  getTrainingActualGps: vi.fn(() => {
    throw new Error("Power BI must not be called in official-match persistence");
  }),
}));

import {
  deletePlannerWeekOfficialMatch,
  getPlannerWeekOfficialMatch,
  setPlannerWeekOfficialMatch,
} from "@/lib/gpsPlanner/weekMatches.server";

const ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "a@t.com",
  role: "admin" as const,
};
const STAFF = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "s@t.com",
  role: "staff" as const,
};
const PLAYER = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "p@t.com",
  role: "player" as const,
};
const WEEK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MATCH_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const GPS_FORBIDDEN = [
  "td",
  "hsr",
  "sprint",
  "acc",
  "dec",
  "duration",
  "powerbi_week_id",
  "match_best",
  "total_distance",
];

function chain(
  result: { data: unknown; error: unknown },
  opts?: {
    single?: boolean;
    maybeSingle?: boolean;
    onInsert?: (payload: unknown) => void;
    onUpdate?: (payload: unknown) => void;
  }
) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  api.select = vi.fn(self);
  api.eq = vi.fn(self);
  api.order = vi.fn(self);
  api.delete = vi.fn(self);
  api.insert = vi.fn((payload: unknown) => {
    opts?.onInsert?.(payload);
    return api;
  });
  api.update = vi.fn((payload: unknown) => {
    opts?.onUpdate?.(payload);
    return api;
  });
  if (opts?.single) api.single = vi.fn().mockResolvedValue(result);
  if (opts?.maybeSingle) api.maybeSingle = vi.fn().mockResolvedValue(result);
  if (!opts?.single && !opts?.maybeSingle) {
    Object.assign(api, {
      then: (resolve: (v: unknown) => unknown) => resolve(result),
    });
  }
  return api;
}

function weekExistsChain() {
  return chain({ data: { id: WEEK_ID }, error: null }, { maybeSingle: true });
}

function matchRow(overrides?: Record<string, unknown>) {
  return {
    id: MATCH_ID,
    week_id: WEEK_ID,
    gps_date: "2026-08-15",
    opponent: "FK Csikszereda",
    matchday: "5",
    competition: null,
    created_by: ADMIN.id,
    updated_by: ADMIN.id,
    created_at: "2026-08-16T00:00:00Z",
    updated_at: "2026-08-16T00:00:00Z",
    ...overrides,
  };
}

const CREATE_INPUT = {
  weekId: WEEK_ID,
  gpsDate: "2026-08-15",
  opponent: "  FK Csikszereda  ",
  matchday: "  5  ",
  competition: "  ",
};

describe("planner week official matches auth", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
  });

  it("F: Admin is allowed to get official match", async () => {
    getAppUser.mockResolvedValue(ADMIN);
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks") return weekExistsChain();
      return chain({ data: null, error: null }, { maybeSingle: true });
    });
    await expect(getPlannerWeekOfficialMatch(WEEK_ID)).resolves.toMatchObject({
      ok: true,
      data: null,
    });
  });

  it("G: Staff is denied", async () => {
    getAppUser.mockResolvedValue(STAFF);
    await expect(getPlannerWeekOfficialMatch(WEEK_ID)).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    await expect(
      setPlannerWeekOfficialMatch(CREATE_INPUT)
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    await expect(
      deletePlannerWeekOfficialMatch(WEEK_ID)
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("H: Player is denied", async () => {
    getAppUser.mockResolvedValue(PLAYER);
    await expect(getPlannerWeekOfficialMatch(WEEK_ID)).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    await expect(
      setPlannerWeekOfficialMatch(CREATE_INPUT)
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    await expect(
      deletePlannerWeekOfficialMatch(WEEK_ID)
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("planner week official matches CRUD", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("B: creates official match identity/display only", async () => {
    const inserts: unknown[] = [];
    const updates: unknown[] = [];
    let officialCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks") return weekExistsChain();
      officialCalls += 1;
      if (officialCalls === 1) {
        return chain({ data: null, error: null }, { maybeSingle: true });
      }
      return chain(
        { data: matchRow({ competition: null }), error: null },
        {
          single: true,
          onInsert: (payload) => inserts.push(payload),
          onUpdate: (payload) => updates.push(payload),
        }
      );
    });

    const result = await setPlannerWeekOfficialMatch(CREATE_INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.gpsDate).toBe("2026-08-15");
    expect(result.data.opponent).toBe("FK Csikszereda");
    expect(result.data.matchday).toBe("5");
    expect(result.data.competition).toBeNull();
    expect(inserts).toHaveLength(1);
    expect(updates).toHaveLength(0);
    const inserted = inserts[0] as Record<string, unknown>;
    expect(inserted.week_id).toBe(WEEK_ID);
    expect(inserted.gps_date).toBe("2026-08-15");
    expect(inserted.opponent).toBe("FK Csikszereda");
    expect(inserted.matchday).toBe("5");
    expect(inserted.competition).toBeNull();
    expect(inserted.created_by).toBe(ADMIN.id);
    for (const key of Object.keys(inserted)) {
      expect(GPS_FORBIDDEN.some((f) => key.toLowerCase().includes(f))).toBe(
        false
      );
    }
  });

  it("A/C: setting again updates the existing row instead of inserting a duplicate", async () => {
    const inserts: unknown[] = [];
    const updates: unknown[] = [];
    let officialCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks") return weekExistsChain();
      officialCalls += 1;
      if (officialCalls === 1) {
        return chain(
          { data: matchRow(), error: null },
          { maybeSingle: true }
        );
      }
      return chain(
        {
          data: matchRow({
            opponent: "Sepsi OSK",
            matchday: "6",
            competition: "Liga 1",
            gps_date: "2026-08-22",
          }),
          error: null,
        },
        {
          maybeSingle: true,
          onInsert: (payload) => inserts.push(payload),
          onUpdate: (payload) => updates.push(payload),
        }
      );
    });

    const result = await setPlannerWeekOfficialMatch({
      weekId: WEEK_ID,
      gpsDate: "2026-08-22",
      opponent: "Sepsi OSK",
      matchday: "6",
      competition: "Liga 1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.opponent).toBe("Sepsi OSK");
    expect(result.data.matchday).toBe("6");
    expect(result.data.competition).toBe("Liga 1");
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      gps_date: "2026-08-22",
      opponent: "Sepsi OSK",
      matchday: "6",
      competition: "Liga 1",
      updated_by: ADMIN.id,
    });
  });

  it("D: clears/deletes official match", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks") return weekExistsChain();
      return chain(
        { data: { week_id: WEEK_ID }, error: null },
        { maybeSingle: true }
      );
    });
    await expect(deletePlannerWeekOfficialMatch(WEEK_ID)).resolves.toMatchObject(
      {
        ok: true,
        data: { weekId: WEEK_ID },
      }
    );
  });

  it("I: gps_date outside planner week range is allowed", async () => {
    const inserts: unknown[] = [];
    let weekSelectArg: unknown;
    let officialCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "planner_weeks") {
        const api = weekExistsChain();
        const originalSelect = api.select as ReturnType<typeof vi.fn>;
        api.select = vi.fn((cols: unknown) => {
          weekSelectArg = cols;
          return originalSelect(cols);
        });
        return api;
      }
      officialCalls += 1;
      if (officialCalls === 1) {
        return chain({ data: null, error: null }, { maybeSingle: true });
      }
      return chain(
        { data: matchRow({ gps_date: "2026-08-15" }), error: null },
        {
          single: true,
          onInsert: (payload) => inserts.push(payload),
        }
      );
    });

    const result = await setPlannerWeekOfficialMatch({
      weekId: WEEK_ID,
      gpsDate: "2026-08-15",
      opponent: "FK Csikszereda",
      matchday: "5",
    });
    expect(result.ok).toBe(true);
    expect(weekSelectArg).toBe("id");
    expect(inserts[0]).toMatchObject({ gps_date: "2026-08-15" });
  });

  it("K: empty opponent is rejected", async () => {
    await expect(
      setPlannerWeekOfficialMatch({
        weekId: WEEK_ID,
        gpsDate: "2026-08-15",
        opponent: "   ",
        matchday: "5",
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid_input" },
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("L: empty matchday is rejected", async () => {
    await expect(
      setPlannerWeekOfficialMatch({
        weekId: WEEK_ID,
        gpsDate: "2026-08-15",
        opponent: "FK Csikszereda",
        matchday: " ",
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid_input" },
    });
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("planner week official matches schema contract", () => {
  it("E/J: migration is sequential, unique week, cascade, admin RLS, no GPS Actuals, no date-range CHECK", async () => {
    const sql = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/043_planner_week_official_matches.sql"
      ),
      "utf8"
    );

    expect(sql).toContain("CREATE TABLE public.planner_week_official_matches");
    expect(sql).toContain(
      "week_id uuid NOT NULL REFERENCES public.planner_weeks(id) ON DELETE CASCADE"
    );
    expect(sql).toContain("UNIQUE (week_id)");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("planner_week_official_matches_admin_select");
    expect(sql).toContain("planner_week_official_matches_admin_insert");
    expect(sql).toContain("planner_week_official_matches_admin_update");
    expect(sql).toContain("planner_week_official_matches_admin_delete");
    expect(sql).toContain("public.current_user_role() = 'admin'");
    expect(sql).not.toMatch(/current_user_role\(\) = 'staff'/);
    expect(sql).not.toMatch(/current_user_role\(\) = 'player'/);
    expect(sql).not.toMatch(/\bTO\s+staff\b/i);
    expect(sql).not.toMatch(/\bTO\s+anon\b/i);
    expect(sql.toLowerCase()).not.toContain("service_role");
    expect(sql).toContain("EXECUTE PROCEDURE public.planner_set_updated_at()");
    expect(sql).toContain(
      "CHECK (length(trim(opponent)) > 0)"
    );
    expect(sql).toContain(
      "CHECK (length(trim(matchday)) > 0)"
    );

    expect(sql).not.toMatch(/gps_date[\s\S]{0,200}BETWEEN/i);
    const checkClauses = [
      ...sql.matchAll(/CONSTRAINT\s+\w+\s+CHECK\s*\(([\s\S]*?)\)/gi),
    ].map((m) => m[1] ?? "");
    expect(checkClauses.length).toBeGreaterThan(0);
    for (const clause of checkClauses) {
      expect(clause).not.toMatch(/start_date|end_date|BETWEEN/i);
    }
    expect(sql).not.toContain("planner_week_days_validate_date");

    const forbiddenCols = [
      "total_distance",
      "hsr",
      "sprint",
      "accelerations",
      "decelerations",
      "duration_actual",
      "duration",
      "powerbi_week_id",
      "match_best",
      "td_best",
      "hsr_best",
    ];
    for (const col of forbiddenCols) {
      expect(sql.toLowerCase()).not.toContain(col);
    }
  });

  it("Phase A 044: prepares 0–2 schema without enabling a second row or dropping UNIQUE(week_id)", async () => {
    const sql = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/044_planner_week_official_matches_v2_prep.sql"
      ),
      "utf8"
    );

    expect(sql).toContain("ADD COLUMN match_order smallint NOT NULL DEFAULT 1");
    expect(sql).toContain("CHECK (match_order IN (1, 2))");
    expect(sql).toContain("ADD COLUMN md_tag text NOT NULL DEFAULT 'MD'");
    expect(sql).toContain(
      "CHECK (length(trim(md_tag)) > 0)"
    );
    expect(sql).toContain("ALTER COLUMN opponent DROP NOT NULL");
    expect(sql).toContain("ALTER COLUMN matchday DROP NOT NULL");
    expect(sql).toContain(
      "CHECK (opponent IS NULL OR length(trim(opponent)) > 0)"
    );
    expect(sql).toContain(
      "CHECK (matchday IS NULL OR length(trim(matchday)) > 0)"
    );
    expect(sql).toContain("UNIQUE (week_id, match_order)");
    expect(sql).toContain("UNIQUE (week_id, gps_date)");
    expect(sql).toMatch(/KEEP[\s\S]*UNIQUE \(week_id\)/i);
    expect(sql).not.toMatch(
      /DROP CONSTRAINT\s+planner_week_official_matches_week_id_key/i
    );
    expect(sql).not.toMatch(/DROP CONSTRAINT[\s\S]{0,80}UNIQUE \(week_id\)/i);
    expect(sql).not.toContain("CREATE TABLE");
    expect(sql).not.toMatch(/ALTER TABLE\s+public\.planner_week_days/i);
    expect(sql).not.toMatch(
      /CREATE TRIGGER[\s\S]{0,120}planner_week_days/i
    );
    expect(sql).not.toContain("CREATE POLICY");
    expect(sql).not.toContain("DROP POLICY");
    expect(sql).not.toContain("ALTER POLICY");
    expect(sql).not.toContain("CREATE TRIGGER");
    expect(sql).not.toContain("match_count");
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i);
    expect(sql.toLowerCase()).not.toContain("service_role");
    expect(sql).not.toMatch(
      /CONSTRAINT[\s\S]{0,120}CHECK[\s\S]{0,200}start_date/i
    );
    expect(sql).not.toMatch(
      /CONSTRAINT[\s\S]{0,120}CHECK[\s\S]{0,200}end_date/i
    );
    expect(sql).not.toMatch(/gps_date[\s\S]{0,200}BETWEEN/i);

    const forbiddenCols = [
      "total_distance",
      "hsr",
      "sprint",
      "accelerations",
      "decelerations",
      "duration_actual",
      "duration",
      "powerbi_week_id",
      "match_best",
      "td_best",
      "hsr_best",
    ];
    for (const col of forbiddenCols) {
      expect(sql.toLowerCase()).not.toContain(col);
    }
  });

  it("Phase A does not consume match_order/md_tag in singular runtime SELECT", async () => {
    const src = await readFile(
      path.join(process.cwd(), "lib/gpsPlanner/weekMatches.server.ts"),
      "utf8"
    );
    expect(src).toContain(
      "id, week_id, gps_date, opponent, matchday, competition, created_by, updated_by, created_at, updated_at"
    );
    expect(src).not.toContain("match_order");
    expect(src).not.toContain("md_tag");
    expect(src).toContain(".maybeSingle()");
  });

  it("does not wire official-match persistence into Planning, Daily Plan, or Training", async () => {
    const files = [
      "app/(app)/admin/planner/WeeklyPlannerView.tsx",
      "app/(app)/admin/planner/GpsLoadPlannerView.tsx",
      "app/(app)/admin/planner/daily-plan/page.tsx",
      "lib/gpsPlanner/progress.server.ts",
      "lib/powerbi/queries/trainingActual.server.ts",
    ];
    for (const rel of files) {
      const src = await readFile(path.join(process.cwd(), rel), "utf8");
      expect(src).not.toContain("weekMatches.server");
      expect(src).not.toContain("planner_week_official_matches");
      expect(src).not.toContain("getPlannerWeekOfficialMatch");
    }
  });
});
