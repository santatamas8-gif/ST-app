import { describe, expect, it } from "vitest";
import {
  formatKioskAverageRpe,
  formatKioskLoadAu,
  formatKioskMatchdayTag,
  formatKioskSessionType,
  formatKioskSubmittedTime,
} from "@/lib/rpe/kioskSessionDisplay";

describe("kiosk session display formatting", () => {
  it("formats valid submitted time in Bucharest time", () => {
    expect(formatKioskSubmittedTime("2026-06-18T13:42:00.000Z")).toBe("16:42");
  });

  it("formats missing or invalid submitted time as dash", () => {
    expect(formatKioskSubmittedTime(null)).toBe("—");
    expect(formatKioskSubmittedTime("not-a-date")).toBe("—");
  });

  it("formats average RPE with one decimal", () => {
    expect(formatKioskAverageRpe(6)).toBe("6.0");
    expect(formatKioskAverageRpe(6.34)).toBe("6.3");
  });

  it("formats total load as whole AU", () => {
    expect(formatKioskLoadAu(1234.56)).toBe("1,235 AU");
  });

  it("formats empty session metadata labels", () => {
    expect(formatKioskSessionType(null)).toBe("—");
    expect(formatKioskMatchdayTag(null)).toBe("No tag");
  });

  it("preserves Multiple labels", () => {
    expect(formatKioskSessionType("Multiple")).toBe("Multiple");
    expect(formatKioskMatchdayTag("Multiple")).toBe("Multiple");
  });
});
