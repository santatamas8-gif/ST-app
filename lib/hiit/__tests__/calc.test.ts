import { describe, expect, it } from "vitest";
import { asrKmh, calcPlayerRow, targetSpeedKmh } from "@/lib/hiit/calc";

const player = { playerId: "p1", name: "A", masKmh: 16, mssKmh: 32 };

describe("hiit calc", () => {
  it("derives ASR in km/h", () => {
    expect(asrKmh(16, 32)).toBe(16);
    expect(asrKmh(16, 16)).toBeNull();
    expect(asrKmh(18, 16)).toBeNull();
  });

  it("targets 30% ASR and 100% MAS", () => {
    expect(targetSpeedKmh(16, 32, "asr", 30)).toBeCloseTo(20.8);
    expect(targetSpeedKmh(16, 32, "mas", 100)).toBe(16);
    expect(targetSpeedKmh(16, 32, "asr", 0)).toBe(16);
  });

  it("interval 15s at 30% ASR is 87 m", () => {
    const row = calcPlayerRow(player, {
      intensityBasis: "asr",
      percent: 30,
      format: "interval",
      workSec: 15,
      restSec: 15,
      reps: 10,
      sets: 4,
      shuttleCount: 2,
      startLossSec: 0.7,
      codLossSec: 1,
    });
    expect(row).not.toBeNull();
    expect(row!.speedKmh).toBeCloseTo(20.8);
    expect(Math.round(row!.meters)).toBe(87);
    expect(Math.round(row!.pctMas)).toBe(130);
    expect(row!.pctAsr).toBeCloseTo(30);
    expect(row!.totalMeters).toBeCloseTo((20.8 / 3.6) * 15 * 10 * 4);
  });

  it("shuttle shortens the leg by start and COD loss", () => {
    const row = calcPlayerRow(player, {
      intensityBasis: "asr",
      percent: 30,
      format: "shuttle",
      workSec: 15,
      restSec: 15,
      reps: 1,
      sets: 1,
      shuttleCount: 2,
      startLossSec: 0.7,
      codLossSec: 1,
    });
    const speedMs = 20.8 / 3.6;
    const usable = 15 - 0.7 - 1;
    const leg = (speedMs * usable) / 2;
    expect(row!.meters).toBeCloseTo(leg);
    expect(row!.totalMeters).toBeCloseTo(leg * 2);
  });

  it("refuses a shuttle when the losses eat the work time", () => {
    const row = calcPlayerRow(player, {
      intensityBasis: "mas",
      percent: 100,
      format: "shuttle",
      workSec: 2,
      restSec: 10,
      reps: 4,
      sets: 2,
      shuttleCount: 4,
      startLossSec: 0.7,
      codLossSec: 1,
    });
    expect(row).toBeNull();
  });
});
