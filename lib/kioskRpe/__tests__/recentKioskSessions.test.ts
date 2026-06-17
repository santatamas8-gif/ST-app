import { describe, expect, it } from "vitest";
import {
  buildRecentKioskPlayerNameMap,
  countDistinctKioskBatchIds,
  formatRecentKioskMatchdayTagLabel,
  formatRecentKioskSessionTypeLabel,
  groupRecentKioskSessions,
  type RecentKioskPlayerProfile,
  type RecentKioskSessionRow,
} from "@/lib/kioskRpe/recentKioskSessions";
import { makeSession, PLAYER_A, PLAYER_B, PLAYER_C, PLAYER_D } from "./fixtures";

const BATCH_OLD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BATCH_NEW = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BATCH_OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function kioskRow(
  partial: Partial<RecentKioskSessionRow> & Pick<RecentKioskSessionRow, "id" | "user_id">
): RecentKioskSessionRow {
  return {
    ...makeSession({
      id: partial.id,
      user_id: partial.user_id,
      date: partial.date ?? "2026-06-17",
    }),
    created_at: "2026-06-17T08:00:00.000Z",
    kiosk_batch_id: BATCH_OLD,
    ...partial,
  };
}

describe("recent Kiosk session grouping", () => {
  const names = {
    [PLAYER_A]: "Charlie Player",
    [PLAYER_B]: "Alpha Player",
    [PLAYER_C]: "Bravo Player",
  };

  it("groups only non-null batch IDs and keeps same-day batches separate", () => {
    const summaries = groupRecentKioskSessions(
      [
        kioskRow({ id: "old-a", user_id: PLAYER_A, kiosk_batch_id: BATCH_OLD, created_at: "2026-06-17T08:00:00.000Z" }),
        kioskRow({ id: "old-b", user_id: PLAYER_B, kiosk_batch_id: BATCH_OLD, created_at: "2026-06-17T08:01:00.000Z" }),
        kioskRow({ id: "new-a", user_id: PLAYER_C, kiosk_batch_id: BATCH_NEW, created_at: "2026-06-17T15:00:00.000Z" }),
        kioskRow({ id: "legacy", user_id: PLAYER_D, kiosk_batch_id: null, created_at: "2026-06-17T16:00:00.000Z" }),
      ],
      names
    );

    expect(summaries).toHaveLength(2);
    expect(summaries.map((summary) => summary.batchId)).toEqual([BATCH_NEW, BATCH_OLD]);
    expect(summaries.every((summary) => summary.date === "2026-06-17")).toBe(true);
    expect(summaries.flatMap((summary) => summary.details).map((detail) => detail.sessionId)).not.toContain(
      "legacy"
    );
  });

  it("calculates summary metrics and preserves sorted detail rows", () => {
    const summaries = groupRecentKioskSessions(
      [
        kioskRow({
          id: "a",
          user_id: PLAYER_A,
          rpe: 6,
          duration: 75,
          load: 450,
          created_at: "2026-06-17T08:02:00.000Z",
        }),
        kioskRow({
          id: "b",
          user_id: PLAYER_B,
          rpe: 7,
          duration: 40,
          load: 280,
          session_type: "Gym",
          matchday_tag: "MD",
          created_at: "2026-06-17T08:00:00.000Z",
        }),
        kioskRow({
          id: "c",
          user_id: PLAYER_A,
          rpe: 6,
          duration: 30,
          load: 180,
          created_at: "2026-06-17T08:01:00.000Z",
        }),
      ],
      names
    );

    const summary = summaries[0];
    expect(summary.playerCount).toBe(2);
    expect(summary.averageRpe).toBe(6.3);
    expect(summary.totalLoad).toBe(910);
    expect(summary.submittedAt).toBe("2026-06-17T08:00:00.000Z");
    expect(summary.sessionTypeLabel).toBe("Multiple");
    expect(summary.matchdayTagLabel).toBe("Multiple");
    expect(summary.details.map((detail) => detail.playerName)).toEqual([
      "Alpha Player",
      "Charlie Player",
      "Charlie Player",
    ]);
    expect(summary.details[0]).toMatchObject({
      sessionId: "b",
      playerId: PLAYER_B,
      rpe: 7,
      duration: 40,
      load: 280,
      sessionType: "Gym",
      matchdayTag: "MD",
    });
  });

  it("returns null submittedAt when the batch has no valid created_at timestamp", () => {
    const [summary] = groupRecentKioskSessions(
      [kioskRow({ id: "a", user_id: PLAYER_A, created_at: "not-a-date" })],
      names
    );

    expect(summary.submittedAt).toBeNull();
  });
});

describe("recent Kiosk session labels", () => {
  it("formats session type labels with strict null handling", () => {
    expect(
      formatRecentKioskSessionTypeLabel([
        kioskRow({ id: "a", user_id: PLAYER_A, session_type: "Pitch" }),
        kioskRow({ id: "b", user_id: PLAYER_B, session_type: "Pitch" }),
      ])
    ).toBe("Pitch");
    expect(
      formatRecentKioskSessionTypeLabel([
        kioskRow({ id: "a", user_id: PLAYER_A, session_type: "Pitch" }),
        kioskRow({ id: "b", user_id: PLAYER_B, session_type: "Rehab" }),
      ])
    ).toBe("Multiple");
    expect(
      formatRecentKioskSessionTypeLabel([
        kioskRow({ id: "a", user_id: PLAYER_A, session_type: null }),
        kioskRow({ id: "b", user_id: PLAYER_B, session_type: null }),
      ])
    ).toBe("—");
    expect(
      formatRecentKioskSessionTypeLabel([
        kioskRow({ id: "a", user_id: PLAYER_A, session_type: "Pitch" }),
        kioskRow({ id: "b", user_id: PLAYER_B, session_type: null }),
      ])
    ).toBe("Multiple");
  });

  it("formats matchday labels with strict null handling", () => {
    expect(
      formatRecentKioskMatchdayTagLabel([
        kioskRow({ id: "a", user_id: PLAYER_A, matchday_tag: "MD-3" }),
        kioskRow({ id: "b", user_id: PLAYER_B, matchday_tag: "MD-3" }),
      ])
    ).toBe("MD-3");
    expect(
      formatRecentKioskMatchdayTagLabel([
        kioskRow({ id: "a", user_id: PLAYER_A, matchday_tag: "MD-3" }),
        kioskRow({ id: "b", user_id: PLAYER_B, matchday_tag: "MD-2" }),
      ])
    ).toBe("Multiple");
    expect(
      formatRecentKioskMatchdayTagLabel([
        kioskRow({ id: "a", user_id: PLAYER_A, matchday_tag: null }),
        kioskRow({ id: "b", user_id: PLAYER_B, matchday_tag: null }),
      ])
    ).toBe("No tag");
    expect(
      formatRecentKioskMatchdayTagLabel([
        kioskRow({ id: "a", user_id: PLAYER_A, matchday_tag: "MD-3" }),
        kioskRow({ id: "b", user_id: PLAYER_B, matchday_tag: null }),
      ])
    ).toBe("Multiple");
  });
});

describe("recent Kiosk player names", () => {
  it("prefers full name, then email, then Unknown player", () => {
    const profiles: RecentKioskPlayerProfile[] = [
      { id: PLAYER_A, full_name: "  Full Name  ", email: "a@example.com" },
      { id: PLAYER_B, full_name: " ", email: "b@example.com" },
      { id: PLAYER_C, full_name: null, email: null },
    ];

    const names = buildRecentKioskPlayerNameMap(profiles);

    expect(names[PLAYER_A]).toBe("Full Name");
    expect(names[PLAYER_B]).toBe("b@example.com");
    expect(names[PLAYER_C]).toBe("Unknown player");
    expect(
      groupRecentKioskSessions([kioskRow({ id: "missing", user_id: PLAYER_D })], names)[0].details[0]
        .playerName
    ).toBe("Unknown player");
  });
});

describe("recent Kiosk batch counting", () => {
  it("counts unique non-null batch IDs only", () => {
    expect(
      countDistinctKioskBatchIds([
        { kiosk_batch_id: BATCH_OLD },
        { kiosk_batch_id: BATCH_OLD },
        { kiosk_batch_id: BATCH_NEW },
        { kiosk_batch_id: BATCH_OTHER },
        { kiosk_batch_id: null },
        {},
      ])
    ).toBe(3);
  });
});
