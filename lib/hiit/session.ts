import { bandMidpoint, type HiitCatalogRow } from "@/lib/hiit/catalog";
import type { HiitBasis, HiitFormat } from "@/lib/hiit/calc";

export type HiitGroupDraft = {
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
  playerIds: string[];
};

export type HiitSessionDraft = {
  id: string | null;
  title: string;
  sessionDate: string;
  groups: [HiitGroupDraft, HiitGroupDraft, HiitGroupDraft];
};

export function emptyGroup(): HiitGroupDraft {
  return {
    intensityBasis: "asr",
    percent: 30,
    format: "interval",
    workSec: 15,
    restSec: 15,
    reps: 8,
    sets: 3,
    shuttleCount: 1,
    startLossSec: 0.7,
    codLossSec: 1,
    playerIds: [],
  };
}

export function emptySession(sessionDate: string): HiitSessionDraft {
  return {
    id: null,
    title: "HIIT",
    sessionDate,
    groups: [emptyGroup(), emptyGroup(), emptyGroup()],
  };
}

export function applyCatalogRow(group: HiitGroupDraft, row: HiitCatalogRow): HiitGroupDraft {
  const band = group.intensityBasis === "mas"
    ? bandMidpoint(row.masMin, row.masMax)
    : bandMidpoint(row.asrMin, row.asrMax);
  return {
    ...group,
    percent: band,
    workSec: row.workSec,
    restSec: row.restSec,
    reps: bandMidpoint(row.repsMin, row.repsMax),
    sets: bandMidpoint(row.setsMin, row.setsMax),
  };
}
