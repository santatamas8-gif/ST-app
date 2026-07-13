import { describe, expect, it, vi } from "vitest";
import {
  analyticsRangeCacheKey,
  freezeAnalyticsRangeResult,
  type AnalyticsRangeResult,
} from "@/lib/kioskRpe/analyticsData";
import { filterSessionsForMatchdayAnalysis } from "@/lib/kioskRpe/matchdayAnalytics";
import { makeSession, PLAYER_A } from "./fixtures";

describe("analyticsData helpers", () => {
  it("builds cache keys as from|to", () => {
    expect(analyticsRangeCacheKey("2026-05-21", "2026-06-17")).toBe("2026-05-21|2026-06-17");
    expect(analyticsRangeCacheKey("2026-05-21", "2026-06-17")).toBe(
      analyticsRangeCacheKey("2026-05-21", "2026-06-17")
    );
    expect(analyticsRangeCacheKey("2026-05-21", "2026-06-17")).not.toBe(
      analyticsRangeCacheKey("2026-05-20", "2026-06-17")
    );
  });

  it("freezes cached results against consumer mutation", () => {
    const source: AnalyticsRangeResult = {
      sessions: [makeSession({ id: "s1", user_id: PLAYER_A, date: "2026-06-10", load: 100 })],
      players: [{ id: PLAYER_A, name: "Player A" }],
      displayNameByUserId: { [PLAYER_A]: "Player A" },
    };
    const frozen = freezeAnalyticsRangeResult(source);

    frozen.sessions[0].load = 999;
    frozen.players[0].name = "Changed";
    frozen.displayNameByUserId[PLAYER_A] = "Changed";

    expect(source.sessions[0].load).toBe(100);
    expect(source.players[0].name).toBe("Player A");
    expect(source.displayNameByUserId[PLAYER_A]).toBe("Player A");

    const filtered = filterSessionsForMatchdayAnalysis(frozen.sessions, {
      from: "2026-06-01",
      to: "2026-06-30",
      mode: "team",
      sessionType: "All session types",
    });
    expect(filtered).toHaveLength(1);
    expect(frozen.sessions[0].load).toBe(999);
  });
});

describe("fetchAnalyticsRange mapping", () => {
  it("maps API response fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sessions: [{ id: "s1", user_id: PLAYER_A, date: "2026-06-10", duration: 75, rpe: 7, load: 525 }],
        players: [{ id: PLAYER_A, name: "Player A" }],
        displayNameByUserId: { [PLAYER_A]: "Player A" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { fetchAnalyticsRange } = await import("@/lib/kioskRpe/analyticsData");
    const result = await fetchAnalyticsRange("2026-06-01", "2026-06-30");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rpe/matchday-analysis?from=2026-06-01&to=2026-06-30",
      { cache: "no-store" }
    );
    expect(result.sessions[0].load).toBe(525);
    expect(result.players[0].name).toBe("Player A");
    expect(result.displayNameByUserId[PLAYER_A]).toBe("Player A");

    vi.unstubAllGlobals();
  });
});
