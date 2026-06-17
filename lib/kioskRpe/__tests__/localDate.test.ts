import { describe, expect, it } from "vitest";
import { getLocalDateString } from "@/lib/kioskRpe/localDate";

describe("getLocalDateString", () => {
  it("returns YYYY-MM-DD format", () => {
    const date = new Date(2026, 5, 17, 15, 30, 0);
    expect(getLocalDateString(date)).toBe("2026-06-17");
  });

  it("preserves local calendar date at midnight", () => {
    const date = new Date(2026, 0, 1);
    expect(getLocalDateString(date)).toBe("2026-01-01");
  });

  it("handles month transition", () => {
    const date = new Date(2026, 2, 1);
    expect(getLocalDateString(date)).toBe("2026-03-01");
    const prev = new Date(2026, 1, 28);
    expect(getLocalDateString(prev)).toBe("2026-02-28");
  });

  it("handles year transition", () => {
    const date = new Date(2025, 11, 31);
    expect(getLocalDateString(date)).toBe("2025-12-31");
  });

  it("handles leap day", () => {
    const date = new Date(2024, 1, 29);
    expect(getLocalDateString(date)).toBe("2024-02-29");
  });
});
