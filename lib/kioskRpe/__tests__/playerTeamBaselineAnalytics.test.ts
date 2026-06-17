import { describe, expect, it } from "vitest";
import {
  buildPlayerTeamBaselineResult,
  calculatePlayerTeamDeviation,
  splitSelectedPlayerAndTeamSessions,
} from "@/lib/kioskRpe/playerTeamBaselineAnalytics";
import { makeSession, PLAYER_A, PLAYER_B, PLAYER_C, STAFF_ID } from "./fixtures";

describe("playerTeamBaselineAnalytics", () => {
  const sessions = [
    makeSession({ id: "p1", user_id: PLAYER_A, date: "2026-06-10", rpe: 8, duration: 70, load: 560 }),
    makeSession({ id: "p2", user_id: PLAYER_A, date: "2026-06-11", rpe: 8, duration: 70, load: 560 }),
    makeSession({ id: "p3", user_id: PLAYER_A, date: "2026-06-12", rpe: 8, duration: 70, load: 560 }),
    makeSession({ id: "t1", user_id: PLAYER_B, date: "2026-06-10", rpe: 6, duration: 60, load: 360 }),
    makeSession({ id: "t2", user_id: PLAYER_B, date: "2026-06-11", rpe: 6, duration: 60, load: 360 }),
    makeSession({ id: "t3", user_id: PLAYER_C, date: "2026-06-10", rpe: 6, duration: 60, load: 360 }),
    makeSession({ id: "t4", user_id: PLAYER_C, date: "2026-06-11", rpe: 6, duration: 60, load: 360 }),
    makeSession({ id: "staff", user_id: STAFF_ID, date: "2026-06-10", rpe: 10, duration: 90, load: 900 }),
  ];

  const validPlayerIds = [PLAYER_A, PLAYER_B, PLAYER_C];

  it("splits selected player out of team baseline", () => {
    const filtered = sessions.filter((s) => validPlayerIds.includes(s.user_id));
    const split = splitSelectedPlayerAndTeamSessions(filtered, PLAYER_A);
    expect(split.playerSessions.every((s) => s.user_id === PLAYER_A)).toBe(true);
    expect(split.teamSessions.every((s) => s.user_id !== PLAYER_A)).toBe(true);
    expect(split.teamSessions.some((s) => s.user_id === STAFF_ID)).toBe(false);
  });

  it("calculates player and team metrics", () => {
    const result = buildPlayerTeamBaselineResult(sessions, {
      selectedPlayerId: PLAYER_A,
      from: "2026-06-01",
      to: "2026-06-30",
      matchdayTag: "All matchday tags",
      sessionType: "All session types",
      validPlayerIds,
    });

    expect(result.player.sessionCount).toBe(3);
    expect(result.player.averageLoad).toBe(560);
    expect(result.player.totalLoad).toBe(1680);
    expect(result.team.sessionCount).toBe(4);
    expect(result.team.uniquePlayerCount).toBe(2);
    expect(result.team.averageLoad).toBe(360);
    expect(result.team.totalLoad).toBe(1440);
  });

  it("calculates team deviation", () => {
    const higher = calculatePlayerTeamDeviation(460, 400, false);
    expect(higher.absoluteDifference).toBe(60);
    expect(higher.percentageDifference).toBeCloseTo(15, 5);
    expect(higher.interpretation).toBe("higher");

    const lower = calculatePlayerTeamDeviation(380, 400, false);
    expect(lower.absoluteDifference).toBe(-20);
    expect(lower.percentageDifference).toBeCloseTo(-5, 5);
    expect(lower.interpretation).toBe("similar");

    const zeroTeam = calculatePlayerTeamDeviation(100, 0, false);
    expect(zeroTeam.percentageDifference).toBeNull();
    expect(zeroTeam.interpretation).toBe("insufficient");
  });

  it("flags insufficient sample sizes", () => {
    const fewPlayerSessions = buildPlayerTeamBaselineResult(
      [makeSession({ id: "one", user_id: PLAYER_A, date: "2026-06-10", load: 500 })],
      {
        selectedPlayerId: PLAYER_A,
        from: "2026-06-01",
        to: "2026-06-30",
        matchdayTag: "All matchday tags",
        sessionType: "All session types",
        validPlayerIds: [PLAYER_A, PLAYER_B],
      }
    );
    expect(fewPlayerSessions.limitedData).toBe(true);
    expect(fewPlayerSessions.deviations.averageLoad.interpretation).toBe("insufficient");

    const fewTeamPlayers = buildPlayerTeamBaselineResult(
      [
        makeSession({ id: "p1", user_id: PLAYER_A, date: "2026-06-10", load: 500 }),
        makeSession({ id: "p2", user_id: PLAYER_A, date: "2026-06-11", load: 500 }),
        makeSession({ id: "p3", user_id: PLAYER_A, date: "2026-06-12", load: 500 }),
        makeSession({ id: "t1", user_id: PLAYER_B, date: "2026-06-10", load: 300 }),
      ],
      {
        selectedPlayerId: PLAYER_A,
        from: "2026-06-01",
        to: "2026-06-30",
        matchdayTag: "All matchday tags",
        sessionType: "All session types",
        validPlayerIds: [PLAYER_A, PLAYER_B],
      }
    );
    expect(fewTeamPlayers.limitedData).toBe(true);
  });

  it("keeps multiple same-day sessions separate under filters", () => {
    const sameDay = [
      makeSession({ id: "a", user_id: PLAYER_A, date: "2026-06-12", session_type: "Pitch", load: 525 }),
      makeSession({ id: "b", user_id: PLAYER_A, date: "2026-06-12", session_type: "Gym", load: 150 }),
    ];
    const pitchOnly = buildPlayerTeamBaselineResult(sameDay, {
      selectedPlayerId: PLAYER_A,
      from: "2026-06-01",
      to: "2026-06-30",
      matchdayTag: "All matchday tags",
      sessionType: "Pitch",
      validPlayerIds: [PLAYER_A],
    });
    expect(pitchOnly.player.sessionCount).toBe(1);
    expect(pitchOnly.player.totalLoad).toBe(525);
  });
});
