import type { KioskRpeSubmitEntry } from "@/lib/kioskRpe/submitValidation";
import { sessionLoad } from "@/utils/load";

export type KioskSessionInsertRow = {
  user_id: string;
  date: string;
  duration: number;
  rpe: number;
  load: number;
  session_type: string;
  matchday_tag: string | null;
  kiosk_batch_id: string;
};

export function buildKioskInsertRows({
  date,
  entries,
  kioskBatchId,
}: {
  date: string;
  entries: KioskRpeSubmitEntry[];
  kioskBatchId: string;
}): KioskSessionInsertRow[] {
  return entries.map((entry) => ({
    user_id: entry.playerId,
    date,
    duration: entry.durationMinutes,
    rpe: entry.rpe,
    load: sessionLoad(entry.durationMinutes, entry.rpe),
    session_type: entry.sessionType,
    matchday_tag: entry.matchdayTag,
    kiosk_batch_id: kioskBatchId,
  }));
}
