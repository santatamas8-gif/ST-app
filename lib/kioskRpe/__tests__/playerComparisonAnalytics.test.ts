import { describe, expect, it } from "vitest";
import {
  buildPlayerComparisonRows,
  filterSessionsForPlayerComparison,
  playerHasComparisonData,
  sortRowsBySelectedPlayerOrder,
} from "@/lib/kioskRpe/playerComparisonAnalytics";
import { makeSession, PLAYER_A, PLAYER_B, PLAYER_C } from "./fixtures";

describe("playerComparisonAnalytics", () => {
  const sessions = [
    makeSession({ id: "s1", user_id: PLAYER_A, date: "2026-06-10", matchday_tag: "MD-3", session_type: "Pitch", rpe: 7, duration: 75, load: 525 }),
    makeSession({ id: "s2", user_id: PLAYER_A, date: "2026-06-10", matchday_tag: "MD-3", session_type: "Gym", rpe: 5, duration: 30, load: 150 }),
    makeSession({ id: "s3", user_id: PLAYER_B, date: "2026-06-10", matchday_tag: "MD-3", rpe: 6, duration: 60, load: 360 }),
  ];

  const filtered = filterSessionsForPlayerComparison(sessions, {
    from: "2026-06-01",
    to: "2026-06-30",
    playerIds: [PLAYER_C, PLAYER_A, PLAYER_B],
    matchdayTag: "All matchday tags",
    sessionType: "All session types",
  });

  const rows = buildPlayerComparisonRows(filtered, [PLAYER_C, PLAYER_A, PLAYER_B], {
    [PLAYER_A]: "Player A",
    [PLAYER_B]: "Player B",
    [PLAYER_C]: "Player C",
  });

  it("preserves selected player order", () => {
    expect(rows.map((row) => row.playerId)).toEqual([PLAYER_C, PLAYER_A, PLAYER_B]);
    const sorted = sortRowsBySelectedPlayerOrder(
      [...rows].reverse(),
      [PLAYER_C, PLAYER_A, PLAYER_B]
    );
    expect(sorted.map((row) => row.playerId)).toEqual([PLAYER_C, PLAYER_A, PLAYER_B]);
  });

  it("keeps players with no data present with zero metrics", () => {
    const zeroRow = rows.find((row) => row.playerId === PLAYER_C)!;
    expect(zeroRow.sessionCount).toBe(0);
    expect(zeroRow.averageRpe).toBeNull();
    expect(zeroRow.averageLoad).toBeNull();
    expect(zeroRow.totalLoad).toBe(0);
    expect(playerHasComparisonData(rows)).toBe(true);
  });

  it("calculates averages from individual rows for player with multiple sessions", () => {
    const playerA = rows.find((row) => row.playerId === PLAYER_A)!;
    expect(playerA.sessionCount).toBe(2);
    expect(playerA.averageRpe).toBe(6);
    expect(playerA.averageDuration).toBe(52.5);
    expect(playerA.averageLoad).toBe(337.5);
    expect(playerA.totalLoad).toBe(675);
  });

  it("applies matchday and session type filters", () => {
    const pitchOnly = filterSessionsForPlayerComparison(sessions, {
      from: "2026-06-01",
      to: "2026-06-30",
      playerIds: [PLAYER_A],
      matchdayTag: "MD-3",
      sessionType: "Pitch",
    });
    expect(pitchOnly).toHaveLength(1);
    expect(pitchOnly[0].session_type).toBe("Pitch");
  });
});
