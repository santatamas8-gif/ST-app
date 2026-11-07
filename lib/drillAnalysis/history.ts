import { formatDrillMetric, formatDurationMinutes, modalDurationMinutes, reportHeadings } from "@/lib/drillAnalysis/format";
import { filterHistoryEntries, type HistoryEntry } from "@/lib/drillAnalysis/historySearch";
import { sessionLabel } from "@/lib/drillAnalysis/keys";
import { isFullTrainingDrill } from "@/lib/drillAnalysis/metrics";
import { DRILL_METRICS, type DrillAnalysisModel, type DrillMetricKey, type DrillOccurrence, type SavedDrillCard, type SessionRef } from "@/lib/drillAnalysis/types";

export { filterHistoryEntries, type HistoryEntry };

const DETAIL_LABEL: Record<DrillMetricKey, string> = {
  totalDistance: "Total Distance",
  tempoDistance: "Tempo Distance",
  hsr: "High Speed Running",
  sprintDistance: "Sprint Distance",
  distancePerMin: "Distance per minute",
  accelerations: "Accelerations",
  decelerations: "Decelerations",
};

export type HistoryDetail = {
  id: string;
  title: string;
  date: string;
  sessionLabel: string;
  hasImage: boolean;
  sets: { label: string; duration: string | null }[];
  metrics: { key: DrillMetricKey; label: string; values: string[] }[];
};

export function buildHistoryCards(
  sessions: {
    session: SessionRef;
    sessionKey: string;
    occurrences: DrillOccurrence[];
    savedCards: SavedDrillCard[];
  }[]
): HistoryEntry[] {
  const ordered = [...sessions].sort((left, right) => {
    if (left.session.date !== right.session.date) return left.session.date < right.session.date ? 1 : -1;
    const leftLabel = sessionLabel(left.session);
    const rightLabel = sessionLabel(right.session);
    return leftLabel < rightLabel ? -1 : leftLabel > rightLabel ? 1 : 0;
  });
  return ordered.flatMap((session) => cardsForSession(session));
}

export function historyDetailFromModel(model: DrillAnalysisModel, cardId: string): HistoryDetail | null {
  const card = model.cards.find((item) => item.id === cardId);
  if (!card) return null;
  const columns = card.columns.filter((column) => !column.missing);
  const labels = columns.map((column) => column.label);
  return {
    id: card.id,
    title: historyCardTitle(card.displayName, labels),
    date: model.session.date,
    sessionLabel: model.sessionLabel,
    hasImage: card.hasImage,
    sets: columns.map((column) => ({
      label: column.label,
      duration: column.durationMinutes === null ? null : formatDurationMinutes(column.durationMinutes),
    })),
    metrics: DRILL_METRICS.map((metric) => ({
      key: metric.key,
      label: DETAIL_LABEL[metric.key],
      values: columns.map((column) => formatDrillMetric(column.metrics[metric.key], metric.unit)),
    })),
  };
}

function cardsForSession(input: {
  session: SessionRef;
  sessionKey: string;
  occurrences: DrillOccurrence[];
  savedCards: SavedDrillCard[];
}): HistoryEntry[] {
  const byKey = new Map(input.occurrences.map((occurrence) => [occurrence.key, occurrence]));
  const used = new Set<string>();
  const pending: Array<HistoryEntry & { sortTime: string | null }> = [];
  const saved = [...input.savedCards].sort((left, right) => left.sortIndex - right.sortIndex);

  for (const card of saved) {
    const live = card.occurrenceKeys.filter((key) => {
      if (used.has(key)) return false;
      const occurrence = byKey.get(key);
      return Boolean(occurrence && !isFullTrainingDrill(occurrence.drill));
    });
    if (live.length === 0) continue;
    live.forEach((key) => used.add(key));
    const drills = live.map((key) => byKey.get(key)?.drill ?? "");
    pending.push(
      entry({
        id: card.id,
        session: input.session,
        sessionKey: input.sessionKey,
        title: historyCardTitle(card.displayName, drills),
        drills,
        displayName: card.displayName,
        setCount: live.length,
        duration: durationLabel(live, byKey),
        hasImage: Boolean(card.imagePath),
        sortTime: earliestTime(live, byKey),
      })
    );
  }

  for (const occurrence of input.occurrences) {
    if (used.has(occurrence.key) || isFullTrainingDrill(occurrence.drill)) continue;
    pending.push(
      entry({
        id: `ungrouped:${occurrence.key}`,
        session: input.session,
        sessionKey: input.sessionKey,
        title: occurrence.drill,
        drills: [occurrence.drill],
        displayName: "",
        setCount: 1,
        duration: durationLabel([occurrence.key], byKey),
        hasImage: false,
        sortTime: occurrence.sortTime,
      })
    );
  }

  pending.sort((left, right) => {
    const byTime = compareTime(left.sortTime, right.sortTime);
    if (byTime !== 0) return byTime;
    return left.title < right.title ? -1 : left.title > right.title ? 1 : 0;
  });
  return pending.map((card) => ({
    id: card.id,
    sessionKey: card.sessionKey,
    date: card.date,
    sessionLabel: card.sessionLabel,
    title: card.title,
    setCount: card.setCount,
    duration: card.duration,
    hasImage: card.hasImage,
    searchText: card.searchText,
  }));
}

function historyCardTitle(displayName: string, drills: string[]): string {
  const headings = reportHeadings(displayName, drills);
  if (headings.title.trim()) return headings.title;
  const unique = [...new Set(drills.map((drill) => drill.trim()).filter(Boolean))];
  if (unique.length === 0) return "Drill";
  if (unique.length === 1) return unique[0];
  return unique.join(" · ");
}

function entry(input: {
  id: string;
  session: SessionRef;
  sessionKey: string;
  title: string;
  drills: string[];
  displayName: string;
  setCount: number;
  duration: string | null;
  hasImage: boolean;
  sortTime: string | null;
}): HistoryEntry & { sortTime: string | null } {
  return {
    id: input.id,
    sessionKey: input.sessionKey,
    date: input.session.date,
    sessionLabel: sessionLabel(input.session),
    title: input.title,
    setCount: input.setCount,
    duration: input.duration,
    hasImage: input.hasImage,
    searchText: [input.title, input.displayName, ...input.drills].join("\n").toLowerCase(),
    sortTime: input.sortTime,
  };
}

function durationLabel(keys: string[], byKey: Map<string, DrillOccurrence>): string | null {
  const parts: string[] = [];
  for (const key of keys) {
    const occurrence = byKey.get(key);
    if (!occurrence) continue;
    const minutes = modalDurationMinutes(occurrence.players.map((player) => player.durationSeconds));
    if (minutes === null) continue;
    parts.push(formatDurationMinutes(minutes));
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function earliestTime(keys: string[], byKey: Map<string, DrillOccurrence>): string | null {
  let best: string | null = null;
  for (const key of keys) {
    const time = byKey.get(key)?.sortTime ?? null;
    if (time && (best === null || time < best)) best = time;
  }
  return best;
}

function compareTime(left: string | null, right: string | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left < right ? -1 : left > right ? 1 : 0;
}
