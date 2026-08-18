import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getAppUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getAppUser: (...args: unknown[]) => getAppUser(...args),
  isAdmin: (role: string) => role === "admin",
}));

const getPlannerWeek = vi.fn();
vi.mock("@/lib/gpsPlanner/weeks.server", () => ({
  getPlannerWeek: (...args: unknown[]) => getPlannerWeek(...args),
}));

const getMatchCandidateDates = vi.fn();
vi.mock("@/lib/powerbi/queries/matchCandidates.server", () => ({
  getMatchCandidateDates: (...args: unknown[]) => getMatchCandidateDates(...args),
}));

import { listPlannerMatchCandidates } from "@/lib/gpsPlanner/matchCandidates.server";

const WEEK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
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
const WEEK = {
  id: WEEK_ID,
  powerbiWeekId: "W5",
  startDate: "2026-08-11",
  endDate: "2026-08-14",
};

describe("listPlannerMatchCandidates", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
    getPlannerWeek.mockReset();
    getMatchCandidateDates.mockReset();
  });

  it("rejects Staff before Power BI", async () => {
    getAppUser.mockResolvedValue(STAFF);
    const result = await listPlannerMatchCandidates(WEEK_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unauthorized");
    expect(getPlannerWeek).not.toHaveBeenCalled();
    expect(getMatchCandidateDates).not.toHaveBeenCalled();
  });

  it("rejects invalid week id without Power BI", async () => {
    const result = await listPlannerMatchCandidates("not-a-uuid");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_input");
    expect(getPlannerWeek).not.toHaveBeenCalled();
    expect(getMatchCandidateDates).not.toHaveBeenCalled();
  });

  it("forwards Admin week lookup failure", async () => {
    getPlannerWeek.mockResolvedValue({
      ok: false,
      error: { code: "unauthorized", message: "Admin access required." },
    });
    const result = await listPlannerMatchCandidates(WEEK_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unauthorized");
    expect(getMatchCandidateDates).not.toHaveBeenCalled();
  });

  it("queries Power BI with the week powerbiWeekId and does not write", async () => {
    getPlannerWeek.mockResolvedValue({ ok: true, data: WEEK });
    getMatchCandidateDates.mockResolvedValue({
      ok: true,
      candidates: [
        { gpsDate: "2026-08-15", rawRowCount: 25, distinctPlayerCount: 15 },
      ],
    });
    const result = await listPlannerMatchCandidates(WEEK_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(getMatchCandidateDates).toHaveBeenCalledWith({ weekId: "W5" });
    expect(result.data[0]?.gpsDate).toBe("2026-08-15");
  });

  it("maps connector failure to a safe powerbi_error", async () => {
    getPlannerWeek.mockResolvedValue({ ok: true, data: WEEK });
    getMatchCandidateDates.mockResolvedValue({
      ok: false,
      error: { code: "timeout", message: "SELECT * FROM secret" },
    });
    const result = await listPlannerMatchCandidates(WEEK_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("powerbi_error");
    expect(result.error.message).not.toMatch(/SELECT|secret/i);
  });
});
