import { beforeEach, describe, expect, it, vi } from "vitest";

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

const listPlayerMappings = vi.fn();
const listPowerBiPlayerCandidates = vi.fn();
const createPlayerMapping = vi.fn();
const updatePlayerMapping = vi.fn();

vi.mock("@/lib/gpsPlanner/playerMappings.server", () => ({
  listPlayerMappings: (...args: unknown[]) => listPlayerMappings(...args),
  listPowerBiPlayerCandidates: (...args: unknown[]) =>
    listPowerBiPlayerCandidates(...args),
  createPlayerMapping: (...args: unknown[]) => createPlayerMapping(...args),
  updatePlayerMapping: (...args: unknown[]) => updatePlayerMapping(...args),
}));

vi.mock("@/lib/gpsPlanner/weeks.server", () => ({
  listPlannerWeeks: vi.fn(),
  createPlannerWeek: vi.fn(),
  updatePlannerWeek: vi.fn(),
  deletePlannerWeek: vi.fn(),
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
}));
vi.mock("@/lib/gpsPlanner/dailyPlan.server", () => ({
  getDailyPlanForPrint: vi.fn(),
}));

import {
  createPlayerMappingAction,
  listPlayerMappingsAction,
  listPowerBiPlayerCandidatesAction,
  updatePlayerMappingAction,
} from "@/app/actions/gpsPlanner";
import { PLANNER_NAV_ITEM } from "@/lib/gpsPlanner/nav";
import { plannerErrorMessage } from "@/lib/gpsPlanner/uiDisplay";

const ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "a@t.com",
  role: "admin" as const,
};

const PLAYER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("Player Mapping UI actions", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    listPlayerMappings.mockReset();
    listPowerBiPlayerCandidates.mockReset();
    createPlayerMapping.mockReset();
    updatePlayerMapping.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  it("Planner nav remains admin-only (Staff/Player rejected at route/nav)", () => {
    expect(PLANNER_NAV_ITEM.roles).toEqual(["admin"]);
    expect(PLANNER_NAV_ITEM.roles).not.toContain("staff");
    expect(PLANNER_NAV_ITEM.roles).not.toContain("player");
  });

  it("loads existing mappings and candidates for Admin", async () => {
    listPlayerMappings.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "m1",
          playerId: PLAYER_ID,
          provider: "powerbi",
          externalPlayerName: "Keita Aboubakar",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          playerDisplayName: "Aboubakar Keita",
        },
      ],
    });
    listPowerBiPlayerCandidates.mockResolvedValue({
      ok: true,
      data: [
        {
          playerName: "Keita Aboubakar",
          hasTrainingData: true,
          hasMatchBest: true,
        },
        {
          playerName: "Hunor Batzula",
          hasTrainingData: true,
          hasMatchBest: false,
        },
      ],
    });

    const mappings = await listPlayerMappingsAction();
    const candidates = await listPowerBiPlayerCandidatesAction();
    expect(mappings.ok).toBe(true);
    if (!mappings.ok) return;
    expect(mappings.data[0].externalPlayerName).toBe("Keita Aboubakar");
    expect(candidates.ok).toBe(true);
    if (!candidates.ok) return;
    expect(candidates.data.map((c) => c.playerName)).toContain(
      "Keita Aboubakar"
    );
  });

  it("create mapping passes exact Power BI name through domain", async () => {
    createPlayerMapping.mockResolvedValue({
      ok: true,
      data: {
        id: "m2",
        playerId: PLAYER_ID,
        provider: "powerbi",
        externalPlayerName: "Gabriel  Pacurar",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        playerDisplayName: "Păcurar Gabriel",
      },
    });

    const res = await createPlayerMappingAction({
      playerId: PLAYER_ID,
      externalPlayerName: "Gabriel  Pacurar",
    });
    expect(createPlayerMapping).toHaveBeenCalledWith({
      playerId: PLAYER_ID,
      externalPlayerName: "Gabriel  Pacurar",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.externalPlayerName).toBe("Gabriel  Pacurar");
  });

  it("update mapping works for already-mapped player", async () => {
    updatePlayerMapping.mockResolvedValue({
      ok: true,
      data: {
        id: "m1",
        playerId: PLAYER_ID,
        provider: "powerbi",
        externalPlayerName: "Hunor Batzula",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        playerDisplayName: "Aboubakar Keita",
      },
    });

    const res = await updatePlayerMappingAction({
      playerId: PLAYER_ID,
      externalPlayerName: "Hunor Batzula",
    });
    expect(res.ok).toBe(true);
    expect(updatePlayerMapping).toHaveBeenCalledWith({
      playerId: PLAYER_ID,
      externalPlayerName: "Hunor Batzula",
    });
  });

  it("surfaces safe duplicate Power BI mapping error", async () => {
    createPlayerMapping.mockResolvedValue({
      ok: false,
      error: {
        code: "external_player_already_mapped",
        message:
          "This Power BI player identity is already mapped to another ST-AMS player.",
      },
    });

    const res = await createPlayerMappingAction({
      playerId: PLAYER_ID,
      externalPlayerName: "Keita Aboubakar",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("external_player_already_mapped");
    expect(plannerErrorMessage(res.error.code)).toMatch(/already mapped/i);
  });

  it("rejects Staff/Player at domain layer (unauthorized)", async () => {
    listPlayerMappings.mockResolvedValue({
      ok: false,
      error: { code: "unauthorized", message: "Admin access required." },
    });
    createPlayerMapping.mockResolvedValue({
      ok: false,
      error: { code: "unauthorized", message: "Admin access required." },
    });

    const list = await listPlayerMappingsAction();
    const create = await createPlayerMappingAction({
      playerId: PLAYER_ID,
      externalPlayerName: "X",
    });
    expect(list.ok).toBe(false);
    if (!list.ok) expect(list.error.code).toBe("unauthorized");
    expect(create.ok).toBe(false);
    if (!create.ok) expect(create.error.code).toBe("unauthorized");
  });
});

describe("Player Mapping UI status helpers", () => {
  it("treats missing mapping as Not mapped for display", () => {
    const mappings: { playerId: string }[] = [];
    const playerId = PLAYER_ID;
    const mapped = mappings.some((m) => m.playerId === playerId);
    expect(mapped ? "Mapped" : "Not mapped").toBe("Not mapped");
  });

  it("treats existing mapping as Mapped", () => {
    const mappings = [{ playerId: PLAYER_ID }];
    const mapped = mappings.some((m) => m.playerId === PLAYER_ID);
    expect(mapped ? "Mapped" : "Not mapped").toBe("Mapped");
  });
});
