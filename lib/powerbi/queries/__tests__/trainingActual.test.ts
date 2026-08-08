import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const executePowerBiDaxQuery = vi.fn();

vi.mock("@/lib/powerbi/client.server", () => ({
  executePowerBiDaxQuery: (...args: unknown[]) => executePowerBiDaxQuery(...args),
}));

import { getTrainingActualGps } from "@/lib/powerbi/queries/trainingActual.server";

function okRows(rows: Record<string, unknown>[]) {
  return {
    ok: true as const,
    results: [{ tables: [{ rows }] }],
  };
}

describe("getTrainingActualGps", () => {
  beforeEach(() => {
    executePowerBiDaxQuery.mockReset();
  });

  it("returns mapped metrics on a single matching row", async () => {
    executePowerBiDaxQuery.mockResolvedValue(
      okRows([
        {
          "[TD]": 6584.95,
          "[Z5]": 632.07,
          "[Z6]": 271.5,
          "[Acc]": 65,
          "[Dec]": 59,
        },
      ])
    );

    const result = await getTrainingActualGps({
      weekId: "W4",
      mdTag: "MD-3",
      playerName: "Carl Davordzie",
      date: "2026-08-07",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        totalDistance: 6584.95,
        hsr: 632.07,
        sprint: 271.5,
        accelerations: 65,
        decelerations: 59,
      },
    });

    const dax = executePowerBiDaxQuery.mock.calls[0][0] as string;
    expect(dax).toContain('GPS_Log[Drill] = "Full Training"');
    expect(dax).toContain('GPS_Log[Week ID] = "W4"');
    expect(dax).toContain('GPS_Log[MD_Tag] = "MD-3"');
    expect(dax).toContain("GPS_Log[Date] = DATE(2026,8,7)");
    expect(dax).not.toContain("SourceFile");
  });

  it("returns not_found when no rows match", async () => {
    executePowerBiDaxQuery.mockResolvedValue(okRows([]));

    const result = await getTrainingActualGps({
      weekId: "W4",
      mdTag: "MD-3",
      playerName: "Unknown Player",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "not_found",
        message:
          "No Full Training GPS row matched the given player, week, and MD tag.",
      },
    });
  });

  it("returns ambiguous when multiple rows match", async () => {
    executePowerBiDaxQuery.mockResolvedValue(
      okRows([
        { TD: 100, Z5: 1, Z6: 1, Acc: 1, Dec: 1 },
        { TD: 200, Z5: 2, Z6: 2, Acc: 2, Dec: 2 },
      ])
    );

    const result = await getTrainingActualGps({
      weekId: "W4",
      mdTag: "MD-3",
      playerName: "Carl Davordzie",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ambiguous");
    }
  });

  it("propagates Power BI connector errors", async () => {
    executePowerBiDaxQuery.mockResolvedValue({
      ok: false,
      error: { code: "auth_failed", message: "Failed to obtain Power BI access token." },
    });

    const result = await getTrainingActualGps({
      weekId: "W4",
      mdTag: "MD-3",
      playerName: "Carl Davordzie",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "auth_failed",
        message: "Failed to obtain Power BI access token.",
      },
    });
  });
});
