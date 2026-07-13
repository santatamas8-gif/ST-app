import type { SessionRow } from "@/lib/types";

export function formatSessionTypeDisplay(value?: string | null): string {
  if (value == null || value.trim() === "") return "—";
  return value.trim();
}

export function formatMatchdayTagDisplay(value?: string | null): string {
  if (value == null || value.trim() === "") return "No tag";
  return value.trim();
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values
        .map((value) => (value == null ? "" : value.trim()))
        .filter((value) => value.length > 0)
    ),
  ];
}

/** Aggregated session type for one player on one day (multiple sessions). */
export function formatAggregatedSessionType(sessions: SessionRow[]): string {
  const types = uniqueNonEmpty(sessions.map((session) => session.session_type));
  if (types.length === 0) return "—";
  if (types.length === 1) return types[0];
  return "Multiple";
}

/** Aggregated matchday tag for one player on one day (multiple sessions). */
export function formatAggregatedMatchdayTag(sessions: SessionRow[]): string {
  const tags = uniqueNonEmpty(sessions.map((session) => session.matchday_tag));
  if (tags.length === 0) return "No tag";
  if (tags.length === 1) return tags[0];
  return "Multiple";
}

export function formatSessionMetadataLine(session: SessionRow): string {
  const type = formatSessionTypeDisplay(session.session_type);
  const tag = formatMatchdayTagDisplay(session.matchday_tag);
  return `${type} · ${tag}`;
}
