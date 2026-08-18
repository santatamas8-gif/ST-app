import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

vi.mock("server-only", () => ({}));

const getAppUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getAppUser: (...args: unknown[]) => getAppUser(...args),
  isAdmin: (role: string) => role === "admin",
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: vi.fn() }),
}));

vi.mock("@/lib/gpsPlanner/weeks.server", () => ({
  listPlannerWeeks: vi.fn(),
  createPlannerWeek: vi.fn(),
  updatePlannerWeek: vi.fn(),
  deletePlannerWeek: vi.fn(),
  getPlannerWeek: vi.fn(),
}));
vi.mock("@/lib/gpsPlanner/weekDays.server", () => ({
  listPlannerWeekDays: vi.fn(),
  createPlannerWeekDay: vi.fn(),
  updatePlannerWeekDay: vi.fn(),
  deletePlannerWeekDay: vi.fn(),
}));
vi.mock("@/lib/gpsPlanner/groups.server", () => ({
  listPlannerGroups: vi.fn(),
  createPlannerGroup: vi.fn(),
  updatePlannerGroup: vi.fn(),
  deletePlannerGroup: vi.fn(),
  listPlannerGroupMembers: vi.fn(),
  addPlannerGroupMember: vi.fn(),
  removePlannerGroupMember: vi.fn(),
}));
vi.mock("@/lib/gpsPlanner/weeklyTargets.server", () => ({
  getPlannerWeeklyTarget: vi.fn(),
  createPlannerWeeklyTarget: vi.fn(),
  updatePlannerWeeklyTarget: vi.fn(),
  deletePlannerWeeklyTarget: vi.fn(),
  listPlannerWeeklyTargets: vi.fn(),
  getPlannerMatchBestSnapshot: vi.fn(),
}));
vi.mock("@/lib/gpsPlanner/dailyTargets.server", () => ({
  getPlannerDailyTarget: vi.fn(),
  listPlannerDailyTargetsForDay: vi.fn(),
  listPlannerDailyTargetsForPlayerWeek: vi.fn(),
  createPlannerDailyTarget: vi.fn(),
  updatePlannerDailyTarget: vi.fn(),
  deletePlannerDailyTarget: vi.fn(),
}));
vi.mock("@/lib/gpsPlanner/progress.server", () => ({
  getPlannerWeeklyProgress: vi.fn(),
  getPlannerWeeklyReviewProgress: vi.fn(),
  getPlannerDailyAnalysis: vi.fn(),
  getPlannerDailyReviewAnalysis: vi.fn(),
}));
vi.mock("@/lib/gpsPlanner/dailyPlan.server", () => ({
  getDailyPlanForPrint: vi.fn(),
}));
vi.mock("@/lib/gpsPlanner/playerMappings.server", () => ({
  listPlayerMappings: vi.fn(),
  listPowerBiPlayerCandidates: vi.fn(),
  createPlayerMapping: vi.fn(),
  updatePlayerMapping: vi.fn(),
  deletePlayerMapping: vi.fn(),
  getPlayerMapping: vi.fn(),
}));

const getPlannerWeekOfficialMatch = vi.fn();
const setPlannerWeekOfficialMatch = vi.fn();
const deletePlannerWeekOfficialMatch = vi.fn();
vi.mock("@/lib/gpsPlanner/weekMatches.server", () => ({
  getPlannerWeekOfficialMatch: (...args: unknown[]) =>
    getPlannerWeekOfficialMatch(...args),
  setPlannerWeekOfficialMatch: (...args: unknown[]) =>
    setPlannerWeekOfficialMatch(...args),
  deletePlannerWeekOfficialMatch: (...args: unknown[]) =>
    deletePlannerWeekOfficialMatch(...args),
}));

const getPlannerTotalLoad = vi.fn();
vi.mock("@/lib/gpsPlanner/totalLoad.server", () => ({
  getPlannerTotalLoad: (...args: unknown[]) => getPlannerTotalLoad(...args),
}));

const listPlannerMatchCandidates = vi.fn();
vi.mock("@/lib/gpsPlanner/matchCandidates.server", () => ({
  listPlannerMatchCandidates: (...args: unknown[]) =>
    listPlannerMatchCandidates(...args),
}));

import {
  deletePlannerWeekOfficialMatchAction,
  getPlannerTotalLoadAction,
  listPlannerMatchCandidatesAction,
  setPlannerWeekOfficialMatchAction,
} from "@/app/actions/gpsPlanner";

const WEEK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "a@t.com",
  role: "admin" as const,
};

const SAVED = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  weekId: WEEK_ID,
  gpsDate: "2026-08-15",
  opponent: "FK Csikszereda",
  matchday: "Matchday 5",
  competition: "Liga 1",
  createdBy: ADMIN.id,
  updatedBy: ADMIN.id,
  createdAt: "",
  updatedAt: "",
};

describe("Total Load UI actions", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
    getPlannerWeekOfficialMatch.mockReset();
    setPlannerWeekOfficialMatch.mockReset();
    deletePlannerWeekOfficialMatch.mockReset();
    getPlannerTotalLoad.mockReset();
    listPlannerMatchCandidates.mockReset();
  });

  it("save official match uses existing Admin persistence", async () => {
    setPlannerWeekOfficialMatch.mockResolvedValue({ ok: true, data: SAVED });
    const result = await setPlannerWeekOfficialMatchAction({
      weekId: WEEK_ID,
      gpsDate: "2026-08-15",
      opponent: "FK Csikszereda",
      matchday: "Matchday 5",
      competition: "Liga 1",
    });
    expect(result.ok).toBe(true);
    expect(setPlannerWeekOfficialMatch).toHaveBeenCalledTimes(1);
    expect(setPlannerWeekOfficialMatch).toHaveBeenCalledWith({
      weekId: WEEK_ID,
      gpsDate: "2026-08-15",
      opponent: "FK Csikszereda",
      matchday: "Matchday 5",
      competition: "Liga 1",
    });
  });

  it("correction updates the same week via setPlannerWeekOfficialMatch", async () => {
    const updated = { ...SAVED, opponent: "Other" };
    setPlannerWeekOfficialMatch.mockResolvedValue({ ok: true, data: updated });
    const result = await setPlannerWeekOfficialMatchAction({
      weekId: WEEK_ID,
      gpsDate: "2026-08-15",
      opponent: "Other",
      matchday: "Matchday 5",
      competition: "Liga 1",
    });
    expect(result.ok).toBe(true);
    expect(setPlannerWeekOfficialMatch).toHaveBeenCalledTimes(1);
    expect(setPlannerWeekOfficialMatch.mock.calls[0][0].weekId).toBe(WEEK_ID);
  });

  it("clear removes the selected relation", async () => {
    deletePlannerWeekOfficialMatch.mockResolvedValue({
      ok: true,
      data: { weekId: WEEK_ID },
    });
    const result = await deletePlannerWeekOfficialMatchAction(WEEK_ID);
    expect(result.ok).toBe(true);
    expect(deletePlannerWeekOfficialMatch).toHaveBeenCalledWith(WEEK_ID);
  });

  it("failed save does not pretend success", async () => {
    setPlannerWeekOfficialMatch.mockResolvedValue({
      ok: false,
      error: { code: "invalid_input", message: "Opponent is required." },
    });
    const result = await setPlannerWeekOfficialMatchAction({
      weekId: WEEK_ID,
      gpsDate: "2026-08-15",
      opponent: "",
      matchday: "Matchday 5",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_input");
  });

  it("Total Load and candidates stay Admin-guarded by domain", async () => {
    getPlannerTotalLoad.mockResolvedValue({
      ok: false,
      error: { code: "unauthorized", message: "Admin access required." },
    });
    listPlannerMatchCandidates.mockResolvedValue({
      ok: false,
      error: { code: "unauthorized", message: "Admin access required." },
    });
    const total = await getPlannerTotalLoadAction(WEEK_ID);
    const candidates = await listPlannerMatchCandidatesAction(WEEK_ID);
    expect(total.ok).toBe(false);
    expect(candidates.ok).toBe(false);
    expect(getPlannerTotalLoad).toHaveBeenCalledWith(WEEK_ID);
    expect(listPlannerMatchCandidates).toHaveBeenCalledWith(WEEK_ID);
  });

  it("candidate lookup is a read-only action wrapper", async () => {
    listPlannerMatchCandidates.mockResolvedValue({
      ok: true,
      data: [
        {
          gpsDate: "2026-08-15",
          rawRowCount: 25,
          distinctPlayerCount: 15,
        },
      ],
    });
    const result = await listPlannerMatchCandidatesAction(WEEK_ID);
    expect(result.ok).toBe(true);
    expect(setPlannerWeekOfficialMatch).not.toHaveBeenCalled();
    expect(deletePlannerWeekOfficialMatch).not.toHaveBeenCalled();
    const src = await readFile(
      path.join(process.cwd(), "lib/gpsPlanner/matchCandidates.server.ts"),
      "utf8"
    );
    expect(src).not.toContain(".insert(");
    expect(src).not.toContain("setPlannerWeekOfficialMatch");
  });
});
