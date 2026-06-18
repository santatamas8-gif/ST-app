import { describe, expect, it } from "vitest";
import {
  buildDailyPlayerRows,
  calculateDailyOverviewMetrics,
  type DailyOverviewPlayer,
} from "@/lib/rpe/dailyOverview";
import type { SessionRow } from "@/lib/types";

const PLAYER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAYER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PLAYER_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const STAFF_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const players: DailyOverviewPlayer[] = [
  { id: PLAYER_A, name: "Alpha Player" },
  { id: PLAYER_B, name: "Bravo Player" },
  { id: PLAYER_C, name: "Charlie Player" },
];

function makeSession(partial: Partial<SessionRow> & Pick<SessionRow, "id" | "user_id">): SessionRow {
  const { id, user_id, ...rest } = partial;
  return {
    id,
    user_id,
    date: "2026-06-18",
    duration: 60,
    rpe: 6,
    load: 360,
    session_type: "Pitch",
    matchday_tag: "MD-3",
    ...rest,
  };
}

describe("calculateDailyOverviewMetrics", () => {
  it("counts unique submitted players and missing players from player roster", () => {
    const sessions = [
      makeSession({ id: "a1", user_id: PLAYER_A, load: 525 }),
      makeSession({ id: "a2", user_id: PLAYER_A, duration: 30, rpe: 5, load: 150 }),
      makeSession({ id: "b1", user_id: PLAYER_B, duration: 40, rpe: 4, load: 160 }),
      makeSession({ id: "staff", user_id: STAFF_ID, load: 999 }),
    ];

    const metrics = calculateDailyOverviewMetrics(sessions, "2026-06-18", players);

    expect(metrics.totalPlayers).toBe(3);
    expect(metrics.submittedPlayers).toBe(2);
    expect(metrics.missingPlayers).toBe(1);
    expect(metrics.sessionCount).toBe(3);
    expect(metrics.totalLoad).toBe(835);
  });

  it("averages RPE and duration across selected-day session entries", () => {
    const sessions = [
      makeSession({ id: "a1", user_id: PLAYER_A, duration: 75, rpe: 7, load: 525 }),
      makeSession({ id: "a2", user_id: PLAYER_A, duration: 30, rpe: 5, load: 150 }),
      makeSession({ id: "b1", user_id: PLAYER_B, duration: 45, rpe: 6, load: 270 }),
      makeSession({ id: "old", user_id: PLAYER_C, date: "2026-06-17", duration: 90, rpe: 10, load: 900 }),
    ];

    const metrics = calculateDailyOverviewMetrics(sessions, "2026-06-18", players);

    expect(metrics.averageRpe).toBe(6);
    expect(metrics.averageDuration).toBe(50);
    expect(metrics.totalLoad).toBe(945);
  });

  it("returns empty selected-day values without sessions", () => {
    const metrics = calculateDailyOverviewMetrics([], "2026-06-18", players);

    expect(metrics.submittedPlayers).toBe(0);
    expect(metrics.missingPlayers).toBe(3);
    expect(metrics.sessionCount).toBe(0);
    expect(metrics.averageRpe).toBeNull();
    expect(metrics.averageDuration).toBeNull();
    expect(metrics.totalLoad).toBe(0);
  });

  it("ignores missing or invalid numeric values consistently", () => {
    const sessions = [
      makeSession({ id: "a1", user_id: PLAYER_A, rpe: null, load: null }),
      makeSession({ id: "b1", user_id: PLAYER_B, duration: Number.NaN, rpe: 8, load: 560 }),
    ];

    const metrics = calculateDailyOverviewMetrics(sessions, "2026-06-18", players);

    expect(metrics.averageRpe).toBe(8);
    expect(metrics.averageDuration).toBe(60);
    expect(metrics.totalLoad).toBe(560);
  });
});

describe("buildDailyPlayerRows", () => {
  it("builds one row for a player with one session", () => {
    const rows = buildDailyPlayerRows(
      [makeSession({ id: "a1", user_id: PLAYER_A, duration: 75, rpe: 7, load: 525 })],
      "2026-06-18",
      players
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: PLAYER_A,
      playerName: "Alpha Player",
      sessionCount: 1,
      averageRpe: 7,
      totalDuration: 75,
      totalLoad: 525,
      sessionTypeLabel: "Pitch",
      matchdayTagLabel: "MD-3",
    });
  });

  it("summarizes multiple same-day sessions for one player", () => {
    const rows = buildDailyPlayerRows(
      [
        makeSession({ id: "a1", user_id: PLAYER_A, duration: 75, rpe: 7, load: 525, session_type: "Pitch", matchday_tag: "MD-3" }),
        makeSession({ id: "a2", user_id: PLAYER_A, duration: 30, rpe: 5, load: 150, session_type: "Gym", matchday_tag: "MD-2" }),
      ],
      "2026-06-18",
      players
    );

    expect(rows[0].sessionCount).toBe(2);
    expect(rows[0].averageRpe).toBe(6);
    expect(rows[0].totalDuration).toBe(105);
    expect(rows[0].totalLoad).toBe(675);
    expect(rows[0].sessionTypeLabel).toBe("Multiple");
    expect(rows[0].matchdayTagLabel).toBe("Multiple");
  });

  it("uses metadata fallbacks when all values are null", () => {
    const rows = buildDailyPlayerRows(
      [
        makeSession({ id: "a1", user_id: PLAYER_A, session_type: null, matchday_tag: null }),
        makeSession({ id: "a2", user_id: PLAYER_A, session_type: null, matchday_tag: null }),
      ],
      "2026-06-18",
      players
    );

    expect(rows[0].sessionTypeLabel).toBe("—");
    expect(rows[0].matchdayTagLabel).toBe("No tag");
  });

  it("sorts rows by total load descending then player name", () => {
    const rows = buildDailyPlayerRows(
      [
        makeSession({ id: "b1", user_id: PLAYER_B, load: 200 }),
        makeSession({ id: "a1", user_id: PLAYER_A, load: 500 }),
        makeSession({ id: "c1", user_id: PLAYER_C, load: 200 }),
      ],
      "2026-06-18",
      players
    );

    expect(rows.map((row) => row.playerName)).toEqual([
      "Alpha Player",
      "Bravo Player",
      "Charlie Player",
    ]);
  });
});
