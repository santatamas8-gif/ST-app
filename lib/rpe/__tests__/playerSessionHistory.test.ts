import { describe, expect, it } from "vitest";
import {
  PLAYER_SESSION_HISTORY_ALL_MATCHDAYS,
  PLAYER_SESSION_HISTORY_ALL_SESSION_TYPES,
  PLAYER_SESSION_HISTORY_NO_TAG,
  buildPlayerSessionHistory,
  calculatePlayerSessionHistorySummary,
} from "@/lib/rpe/playerSessionHistory";
import type { SessionRow } from "@/lib/types";

const PLAYER_A = "player-a";
const PLAYER_B = "player-b";

function session(overrides: Partial<SessionRow> & Pick<SessionRow, "id" | "date">): SessionRow {
  return {
    id: overrides.id,
    user_id: "user_id" in overrides ? overrides.user_id! : PLAYER_A,
    date: overrides.date,
    duration: "duration" in overrides ? overrides.duration! : 60,
    rpe: "rpe" in overrides ? overrides.rpe! : 5,
    load: "load" in overrides ? overrides.load! : 300,
    session_type: "session_type" in overrides ? overrides.session_type : "Pitch",
    matchday_tag: "matchday_tag" in overrides ? overrides.matchday_tag : "MD-1",
    created_at: overrides.created_at,
    kiosk_batch_id: overrides.kiosk_batch_id,
  };
}

function build(
  sessions: SessionRow[],
  overrides: Partial<Parameters<typeof buildPlayerSessionHistory>[1]> = {}
) {
  return buildPlayerSessionHistory(sessions, {
    playerId: PLAYER_A,
    limit: 10,
    matchdayFilter: PLAYER_SESSION_HISTORY_ALL_MATCHDAYS,
    sessionTypeFilter: PLAYER_SESSION_HISTORY_ALL_SESSION_TYPES,
    ...overrides,
  });
}

describe("buildPlayerSessionHistory grouping and aggregation", () => {
  it("creates one date from one session", () => {
    const days = build([session({ id: "s1", date: "2026-06-01" })]);
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({
      date: "2026-06-01",
      sessionCount: 1,
      averageRpe: 5,
      totalDuration: 60,
      totalLoad: 300,
      sessionTypeLabel: "Pitch",
      matchdayTagLabel: "MD-1",
    });
  });

  it("groups two same-day sessions into one daily row and preserves details", () => {
    const days = build([
      session({ id: "s1", date: "2026-06-01", duration: 75, rpe: 7, load: 525, session_type: "Pitch" }),
      session({ id: "s2", date: "2026-06-01", duration: 30, rpe: 5, load: 150, session_type: "Gym" }),
    ]);

    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({
      sessionCount: 2,
      averageRpe: 6,
      totalDuration: 105,
      totalLoad: 675,
      sessionTypeLabel: "Multiple",
      matchdayTagLabel: "MD-1",
    });
    expect(days[0].sessions).toHaveLength(2);
  });

  it("keeps different dates separate", () => {
    const days = build([
      session({ id: "s1", date: "2026-06-01" }),
      session({ id: "s2", date: "2026-06-02" }),
    ]);
    expect(days.map((day) => day.date)).toEqual(["2026-06-02", "2026-06-01"]);
  });

  it("handles null and multiple metadata labels", () => {
    const nullOnly = build([
      session({ id: "s1", date: "2026-06-01", session_type: null, matchday_tag: null }),
    ]);
    expect(nullOnly[0].sessionTypeLabel).toBe("—");
    expect(nullOnly[0].matchdayTagLabel).toBe("No tag");

    const mixed = build([
      session({ id: "s2", date: "2026-06-02", session_type: "Pitch", matchday_tag: "MD-1" }),
      session({ id: "s3", date: "2026-06-02", session_type: "Gym", matchday_tag: "MD-2" }),
    ]);
    expect(mixed[0].sessionTypeLabel).toBe("Multiple");
    expect(mixed[0].matchdayTagLabel).toBe("Multiple");
  });
});

describe("buildPlayerSessionHistory filtering", () => {
  it("filters by selected player before grouping", () => {
    const days = build([
      session({ id: "s1", date: "2026-06-01", user_id: PLAYER_A }),
      session({ id: "s2", date: "2026-06-02", user_id: PLAYER_B }),
    ]);
    expect(days.map((day) => day.date)).toEqual(["2026-06-01"]);
  });

  it("supports all matchdays, specific matchday and no tag", () => {
    const rows = [
      session({ id: "s1", date: "2026-06-01", matchday_tag: "MD-1" }),
      session({ id: "s2", date: "2026-06-02", matchday_tag: "MD-2" }),
      session({ id: "s3", date: "2026-06-03", matchday_tag: null }),
    ];

    expect(build(rows, { matchdayFilter: PLAYER_SESSION_HISTORY_ALL_MATCHDAYS })).toHaveLength(3);
    expect(build(rows, { matchdayFilter: "MD-1" }).map((day) => day.date)).toEqual(["2026-06-01"]);
    expect(build(rows, { matchdayFilter: PLAYER_SESSION_HISTORY_NO_TAG }).map((day) => day.date)).toEqual(["2026-06-03"]);
  });

  it("supports all session types and a specific session type before grouping", () => {
    const rows = [
      session({ id: "s1", date: "2026-06-01", session_type: "Pitch" }),
      session({ id: "s2", date: "2026-06-01", session_type: "Gym" }),
      session({ id: "s3", date: "2026-06-02", session_type: "Gym" }),
    ];

    expect(build(rows, { sessionTypeFilter: PLAYER_SESSION_HISTORY_ALL_SESSION_TYPES })[0].sessionCount).toBe(1);
    const gym = build(rows, { sessionTypeFilter: "Gym" });
    expect(gym.map((day) => day.date)).toEqual(["2026-06-02", "2026-06-01"]);
    expect(gym.find((day) => day.date === "2026-06-01")?.sessionCount).toBe(1);
  });
});

describe("buildPlayerSessionHistory limits and order", () => {
  const rows = Array.from({ length: 21 }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return session({ id: `s-${day}`, date: `2026-06-${day}`, load: index + 1 });
  });

  it("selects newest matching dates for limit 5, 10 and 20", () => {
    expect(build(rows, { limit: 5 }).map((day) => day.date)).toEqual([
      "2026-06-21",
      "2026-06-20",
      "2026-06-19",
      "2026-06-18",
      "2026-06-17",
    ]);
    expect(build(rows, { limit: 10 })).toHaveLength(10);
    expect(build(rows, { limit: 20 })).toHaveLength(20);
  });

  it("returns chart order oldest to newest when requested", () => {
    expect(build(rows, { limit: 5, chartOrder: "chronological" }).map((day) => day.date)).toEqual([
      "2026-06-17",
      "2026-06-18",
      "2026-06-19",
      "2026-06-20",
      "2026-06-21",
    ]);
  });

  it("returns only real days when fewer than requested are available", () => {
    expect(build(rows.slice(0, 3), { limit: 20 })).toHaveLength(3);
  });
});

describe("calculatePlayerSessionHistorySummary", () => {
  it("summarizes latest, average, highest and lowest load", () => {
    const days = build([
      session({ id: "s1", date: "2026-06-01", load: 100 }),
      session({ id: "s2", date: "2026-06-02", load: 300 }),
      session({ id: "s3", date: "2026-06-03", load: 200 }),
    ]);
    expect(calculatePlayerSessionHistorySummary(days)).toEqual({
      daysShown: 3,
      latestLoad: 200,
      latestDate: "2026-06-03",
      averageDailyLoad: 200,
      highestDailyLoad: 300,
      lowestDailyLoad: 100,
    });
  });

  it("returns empty summary for no data", () => {
    expect(calculatePlayerSessionHistorySummary([])).toEqual({
      daysShown: 0,
      latestLoad: null,
      latestDate: null,
      averageDailyLoad: null,
      highestDailyLoad: null,
      lowestDailyLoad: null,
    });
  });
});
