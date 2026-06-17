import { describe, expect, it } from "vitest";
import {
  buildMatchdayAnalytics,
  filterSessionsForMatchdayAnalysis,
  normalizeMatchdayTag,
  sortMatchdayAnalyticsRows,
} from "@/lib/kioskRpe/matchdayAnalytics";
import { makeSession, PLAYER_A, PLAYER_B } from "./fixtures";

describe("matchdayAnalytics", () => {
  const sessions = [
    makeSession({ id: "s1", user_id: PLAYER_A, date: "2026-06-10", matchday_tag: "MD+1", rpe: 8, duration: 60, load: 480 }),
    makeSession({ id: "s2", user_id: PLAYER_B, date: "2026-06-10", matchday_tag: "MD-3", rpe: 6, duration: 75, load: 450 }),
    makeSession({ id: "s3", user_id: PLAYER_A, date: "2026-06-11", matchday_tag: null, session_type: null, rpe: 5, duration: 30, load: 150 }),
    makeSession({ id: "s4", user_id: PLAYER_A, date: "2026-06-11", matchday_tag: "MD-3", session_type: "Gym", rpe: 5, duration: 30, load: 150 }),
  ];

  it("normalizes null matchday tag to No tag", () => {
    expect(normalizeMatchdayTag(null)).toBe("No tag");
    expect(normalizeMatchdayTag("")).toBe("No tag");
  });

  it("sorts rows in fixed matchday order", () => {
    const rows = sortMatchdayAnalyticsRows(buildMatchdayAnalytics(sessions));
    expect(rows.map((row) => row.tag)).toEqual(["MD+1", "MD-3", "No tag"]);
  });

  it("calculates metrics from individual session rows", () => {
    const md3 = buildMatchdayAnalytics(sessions).find((row) => row.tag === "MD-3")!;
    expect(md3.sessionCount).toBe(2);
    expect(md3.uniquePlayerCount).toBe(2);
    expect(md3.averageRpe).toBe(5.5);
    expect(md3.averageDuration).toBe(52.5);
    expect(md3.averageLoad).toBe(300);
    expect(md3.totalLoad).toBe(600);
  });

  it("counts multiple same-day sessions separately", () => {
    const sameDay = [
      makeSession({ id: "a", user_id: PLAYER_A, date: "2026-06-12", matchday_tag: "MD-3", session_type: "Pitch", load: 525 }),
      makeSession({ id: "b", user_id: PLAYER_A, date: "2026-06-12", matchday_tag: "MD-3", session_type: "Gym", load: 150 }),
    ];
    const row = buildMatchdayAnalytics(sameDay).find((r) => r.tag === "MD-3")!;
    expect(row.sessionCount).toBe(2);
    expect(row.totalLoad).toBe(675);
  });

  it("filters by session type while keeping legacy null types for All", () => {
    const all = filterSessionsForMatchdayAnalysis(sessions, {
      from: "2026-06-01",
      to: "2026-06-30",
      mode: "team",
      sessionType: "All session types",
    });
    expect(all).toHaveLength(4);

    const pitch = filterSessionsForMatchdayAnalysis(sessions, {
      from: "2026-06-01",
      to: "2026-06-30",
      mode: "team",
      sessionType: "Pitch",
    });
    expect(pitch).toHaveLength(2);

    const gym = filterSessionsForMatchdayAnalysis(sessions, {
      from: "2026-06-01",
      to: "2026-06-30",
      mode: "team",
      sessionType: "Gym",
    });
    expect(gym).toHaveLength(1);
  });
});
