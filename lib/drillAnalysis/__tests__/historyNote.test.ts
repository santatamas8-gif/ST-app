import { describe, expect, it } from "vitest";
import { isHistoryNoteEntry, normalizeHistoryNote } from "@/lib/drillAnalysis/historyNote";
import { buildOccurrenceKey, buildSessionKey } from "@/lib/drillAnalysis/keys";
import type { SessionRef } from "@/lib/drillAnalysis/types";

const session: SessionRef = { date: "2026-11-06", weekId: "W17", mdTag: "MD-2", sessionType: "Team" };

describe("history notes", () => {
  it("accepts a saved card and an ungrouped drill from the same session", () => {
    const sessionKey = buildSessionKey(session);
    const occurrenceKey = buildOccurrenceKey(session, "Warm up", "10:00:00");
    expect(isHistoryNoteEntry(sessionKey, "123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(isHistoryNoteEntry(sessionKey, `ungrouped:${occurrenceKey}`)).toBe(true);
  });

  it("rejects a drill from another session and a note that is too long", () => {
    const sessionKey = buildSessionKey(session);
    const other = buildOccurrenceKey(
      { date: "2026-11-05", weekId: "W17", mdTag: "MD-3", sessionType: "Team" },
      "Warm up",
      "10:00:00"
    );
    expect(isHistoryNoteEntry(sessionKey, `ungrouped:${other}`)).toBe(false);
    expect(isHistoryNoteEntry(sessionKey, "not-a-drill")).toBe(false);
    expect(normalizeHistoryNote("  cones on the left  ")).toEqual({ ok: true, note: "cones on the left" });
    expect(normalizeHistoryNote("   ")).toEqual({ ok: true, note: null });
    expect(normalizeHistoryNote("a".repeat(2001)).ok).toBe(false);
  });
});
