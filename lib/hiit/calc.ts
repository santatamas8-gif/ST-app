export type HiitBasis = "mas" | "asr";
export type HiitFormat = "interval" | "shuttle";

export type HiitPlayerSpeed = {
  playerId: string;
  name: string;
  masKmh: number;
  mssKmh: number;
};

export type HiitGroupCalcInput = {
  intensityBasis: HiitBasis;
  percent: number;
  format: HiitFormat;
  workSec: number;
  restSec: number;
  reps: number;
  sets: number;
  shuttleCount: number;
  startLossSec: number;
  codLossSec: number;
};

export type HiitPlayerCalc = {
  playerId: string;
  name: string;
  masKmh: number;
  mssKmh: number;
  asrKmh: number;
  speedKmh: number;
  pctMas: number;
  pctAsr: number;
  /** Cone distance. Interval: the straight rep. Shuttle: one leg. */
  meters: number;
  totalMeters: number;
};

const KM_H_TO_M_S = 3.6;

export function asrKmh(masKmh: number, mssKmh: number): number | null {
  if (!Number.isFinite(masKmh) || !Number.isFinite(mssKmh)) return null;
  if (!(masKmh > 0) || !(mssKmh > masKmh)) return null;
  return mssKmh - masKmh;
}

export function targetSpeedKmh(
  masKmh: number,
  mssKmh: number,
  basis: HiitBasis,
  percent: number
): number | null {
  const asr = asrKmh(masKmh, mssKmh);
  if (asr == null || !Number.isFinite(percent)) return null;
  if (basis === "mas") {
    if (!(percent > 0)) return null;
    return masKmh * (percent / 100);
  }
  if (percent < 0) return null;
  return masKmh + asr * (percent / 100);
}

export function repMeters(input: {
  speedKmh: number;
  workSec: number;
  format: HiitFormat;
  shuttleCount: number;
  startLossSec: number;
  codLossSec: number;
}): { meters: number; legs: number } | null {
  const { speedKmh, workSec, format } = input;
  if (!(speedKmh > 0) || !(workSec > 0)) return null;
  const speedMs = speedKmh / KM_H_TO_M_S;
  if (format === "interval") {
    return { meters: speedMs * workSec, legs: 1 };
  }
  const legs = input.shuttleCount;
  if (!Number.isInteger(legs) || legs < 2) return null;
  if (!(input.startLossSec >= 0) || !(input.codLossSec >= 0)) return null;
  const usable = workSec - input.startLossSec - (legs - 1) * input.codLossSec;
  if (!(usable > 0)) return null;
  return { meters: (speedMs * usable) / legs, legs };
}

export function calcPlayerRow(
  player: HiitPlayerSpeed,
  group: HiitGroupCalcInput
): HiitPlayerCalc | null {
  const asr = asrKmh(player.masKmh, player.mssKmh);
  const speed = targetSpeedKmh(player.masKmh, player.mssKmh, group.intensityBasis, group.percent);
  if (asr == null || speed == null) return null;
  if (!(group.reps > 0) || !(group.sets > 0) || !(group.restSec >= 0)) return null;
  const rep = repMeters({
    speedKmh: speed,
    workSec: group.workSec,
    format: group.format,
    shuttleCount: group.shuttleCount,
    startLossSec: group.startLossSec,
    codLossSec: group.codLossSec,
  });
  if (!rep) return null;
  const totalMeters = rep.meters * rep.legs * group.reps * group.sets;
  return {
    playerId: player.playerId,
    name: player.name,
    masKmh: player.masKmh,
    mssKmh: player.mssKmh,
    asrKmh: asr,
    speedKmh: speed,
    pctMas: (speed / player.masKmh) * 100,
    pctAsr: ((speed - player.masKmh) / asr) * 100,
    meters: rep.meters,
    totalMeters,
  };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function round0(n: number): number {
  return Math.round(n);
}
