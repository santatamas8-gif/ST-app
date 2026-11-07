import { escapeDaxString, parseIsoDateParts } from "@/lib/powerbi/queries/rowUtils";
import type { SessionRef } from "@/lib/drillAnalysis/types";

/**
 * Distinct player/drill/start rows for history cards.
 * No metric columns and no aggregation.
 */
export function buildDrillHistoryIdentityDax(): string {
  return `EVALUATE
SUMMARIZECOLUMNS(
  GPS_Log[Date],
  GPS_Log[Week ID],
  GPS_Log[MD_Tag],
  GPS_Log[SessionType],
  GPS_Log[Player],
  GPS_Log[Drill],
  GPS_Log[Drill Start Time],
  GPS_Log[Duration]
)`;
}

/** Read-only session list. Does not aggregate drill metrics. */
export function buildDrillSessionListDax(): string {
  return `EVALUATE
SUMMARIZECOLUMNS(
  GPS_Log[Date],
  GPS_Log[Week ID],
  GPS_Log[MD_Tag],
  GPS_Log[SessionType]
)`;
}

/**
 * Raw player rows for one session.
 * Metrics stay on the row. Averaging happens in application code.
 */
export function buildDrillSessionRowsDax(session: SessionRef): string | null {
  const parts = parseIsoDateParts(session.date);
  if (!parts) return null;
  const weekId = escapeDaxString(session.weekId);
  const mdTag = escapeDaxString(session.mdTag);
  const sessionType = escapeDaxString(session.sessionType);
  return `EVALUATE
SELECTCOLUMNS(
  FILTER(
    GPS_Log,
    GPS_Log[Date] = DATE(${parts.year},${parts.month},${parts.day})
      && GPS_Log[Week ID] = "${weekId}"
      && GPS_Log[MD_Tag] = "${mdTag}"
      && GPS_Log[SessionType] = "${sessionType}"
  ),
  "Player", GPS_Log[Player],
  "Drill", GPS_Log[Drill],
  "DrillStart", GPS_Log[Drill Start Time],
  "TD", GPS_Log[TD],
  "Z4", GPS_Log[Z4],
  "Z5", GPS_Log[Z5],
  "Z6", GPS_Log[Z6],
  "Acc", GPS_Log[Acc],
  "Dec", GPS_Log[Dec],
  "DistancePerMin", GPS_Log[Distance Per Min],
  "Duration", GPS_Log[Duration]
)`;
}
