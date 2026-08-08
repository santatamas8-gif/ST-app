import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const executePowerBiDaxQuery = vi.fn();

vi.mock("@/lib/powerbi/client.server", () => ({
  executePowerBiDaxQuery: (...args: unknown[]) => executePowerBiDaxQuery(...args),
}));

import { getMatchBestGps } from "@/lib/powerbi/queries/matchBest.server";

function okRows(rows: Record<string, unknown>[]) {
  return {
    ok: true as const,
    results: [{ tables: [{ rows }] }],
  };
}

describe("getMatchBestGps", () => {
  beforeEach(() => {
    executePowerBiDaxQuery.mockReset();
  });

  it("returns mapped bests on a single matching row", async () => {
    executePowerBiDaxQuery.mockResolvedValue(
      okRows([
        {
          "[Max TD]": 9326,
          "[Max Z5]": 677,
          "[Max Z6]": 328,
          "[Max Acc]": 111,
          "[Max Dec]": 115,
        },
      ])
    );

    const result = await getMatchBestGps({ playerName: "Carl Davordzie" });

    expect(result).toEqual({
      ok: true,
      data: {
        tdBest: 9326,
        hsrBest: 677,
        sprintBest: 328,
        accBest: 111,
        decBest: 115,
      },
    });

    const dax = executePowerBiDaxQuery.mock.calls[0][0] as string;
    expect(dax).toContain('Match_Benchmark[Method] = "single-match best"');
    expect(dax).toContain('Match_Benchmark[Player] = "Carl Davordzie"');
    expect(dax).not.toContain("Position");
  });

  it("returns not_found when no rows match", async () => {
    executePowerBiDaxQuery.mockResolvedValue(okRows([]));

    const result = await getMatchBestGps({ playerName: "Unknown Player" });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "not_found",
        message:
          "No single-match best row matched the given player in Match_Benchmark.",
      },
    });
  });

  it("returns ambiguous when multiple rows match", async () => {
    executePowerBiDaxQuery.mockResolvedValue(
      okRows([
        { "Max TD": 1, "Max Z5": 1, "Max Z6": 1, "Max Acc": 1, "Max Dec": 1 },
        { "Max TD": 2, "Max Z5": 2, "Max Z6": 2, "Max Acc": 2, "Max Dec": 2 },
      ])
    );

    const result = await getMatchBestGps({ playerName: "Carl Davordzie" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ambiguous");
    }
  });

  it("propagates Power BI connector errors", async () => {
    executePowerBiDaxQuery.mockResolvedValue({
      ok: false,
      error: { code: "timeout", message: "Power BI request timed out." },
    });

    const result = await getMatchBestGps({ playerName: "Carl Davordzie" });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "timeout",
        message: "Power BI request timed out.",
      },
    });
  });
});
