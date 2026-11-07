import { buildSessionKey, sessionLabel } from "@/lib/drillAnalysis/keys";
import { modalDurationMinutes } from "@/lib/drillAnalysis/format";
import { isFullTrainingDrill, metricsForPlayer, roundedMetrics } from "@/lib/drillAnalysis/metrics";
import type {
  DrillAnalysisModel,
  DrillColumn,
  DrillOccurrence,
  DrillViewCard,
  EditorCard,
  FullTrainingView,
  PlayerOccurrenceValues,
  SavedDrillCard,
  SessionRef,
} from "@/lib/drillAnalysis/types";

function durationMinutesFor(occurrence: DrillOccurrence, player: string | null, missing: boolean): number | null {
  if (missing) return null;
  if (player !== null) {
    const match = occurrence.players.find((row) => row.player === player);
    return modalDurationMinutes(match ? [match.durationSeconds] : []);
  }
  return modalDurationMinutes(occurrence.players.map((row) => row.durationSeconds));
}

function columnFor(
  occurrence: DrillOccurrence,
  player: string | null,
  missing: boolean
): DrillColumn {
  return {
    label: occurrence.drill,
    occurrenceKey: occurrence.key,
    timeLabel: missing ? "Missing source occurrence" : occurrence.timeLabel,
    uncertain: missing || occurrence.timeUncertain,
    missing,
    hasPlayerConflict: occurrence.hasPlayerConflict,
    durationMinutes: durationMinutesFor(occurrence, player, missing),
    metrics: missing ? roundedMetrics(metricsForPlayer({ ...occurrence, players: [] }, player)) : roundedMetrics(metricsForPlayer(occurrence, player)),
  };
}

function playerSlice(occurrence: DrillOccurrence, player: string): PlayerOccurrenceValues {
  const column = columnFor(occurrence, player, false);
  return { metrics: column.metrics, durationMinutes: column.durationMinutes };
}

function missingColumn(key: string): DrillColumn {
  return {
    label: "Missing source occurrence",
    occurrenceKey: key,
    timeLabel: "Missing source occurrence",
    uncertain: true,
    missing: true,
    hasPlayerConflict: false,
    durationMinutes: null,
    metrics: {
      totalDistance: null,
      tempoDistance: null,
      hsr: null,
      sprintDistance: null,
      distancePerMin: null,
      accelerations: null,
      decelerations: null,
    },
  };
}

export function buildDrillAnalysisModel(input: {
  session: SessionRef;
  occurrences: DrillOccurrence[];
  savedCards: SavedDrillCard[];
  player: string | null;
  excludedBlankDrillRows: number;
  excludedBlankPlayerRows: number;
}): DrillAnalysisModel {
  const byKey = new Map(input.occurrences.map((occurrence) => [occurrence.key, occurrence]));
  const sourceOrder = new Map(input.occurrences.map((occurrence, index) => [occurrence.key, index]));
  const used = new Set<string>();
  const placed: Array<{ anchor: number; card: DrillViewCard; editor?: EditorCard }> = [];

  function anchorOf(keys: string[]): number {
    let earliest = Number.POSITIVE_INFINITY;
    for (const key of keys) {
      const index = sourceOrder.get(key);
      if (index !== undefined && index < earliest) earliest = index;
    }
    return earliest;
  }

  const saved = [...input.savedCards];
  for (const savedCard of saved) {
    const columns: DrillColumn[] = [];
    savedCard.occurrenceKeys.forEach((key) => {
      const occurrence = byKey.get(key);
      if (!occurrence || isFullTrainingDrill(occurrence.drill)) {
        columns.push(missingColumn(key));
        return;
      }
      used.add(key);
      columns.push(columnFor(occurrence, input.player, false));
    });
    const card: DrillViewCard = {
      id: savedCard.id,
      displayName: savedCard.displayName,
      persisted: true,
      hasImage: Boolean(savedCard.imagePath),
      columns,
      missingCount: columns.filter((column) => column.missing).length,
    };
    placed.push({
      anchor: anchorOf(savedCard.occurrenceKeys),
      card,
      editor: {
        id: savedCard.id,
        displayName: savedCard.displayName,
        hasImage: Boolean(savedCard.imagePath),
        occurrenceKeys: [...savedCard.occurrenceKeys],
      },
    });
  }

  const ungrouped = input.occurrences.filter(
    (occurrence) => !used.has(occurrence.key) && !isFullTrainingDrill(occurrence.drill)
  );
  for (const occurrence of ungrouped) {
    placed.push({
      anchor: sourceOrder.get(occurrence.key) ?? Number.POSITIVE_INFINITY,
      card: {
        id: `ungrouped:${occurrence.key}`,
        displayName: occurrence.drill,
        persisted: false,
        hasImage: false,
        columns: [columnFor(occurrence, input.player, false)],
        missingCount: 0,
      },
    });
  }

  placed.sort((a, b) => a.anchor - b.anchor || (a.card.id < b.card.id ? -1 : a.card.id > b.card.id ? 1 : 0));
  const cards = placed.map((item) => item.card);
  const editorCards = placed.flatMap((item) => (item.editor ? [item.editor] : []));

  const fullTrainingOccurrences = input.occurrences.filter((occurrence) => isFullTrainingDrill(occurrence.drill));
  const fullTraining: FullTrainingView = {
    status: fullTrainingOccurrences.length === 0 ? "missing" : fullTrainingOccurrences.length === 1 ? "ready" : "repeated",
    columns: fullTrainingOccurrences.map((occurrence) => columnFor(occurrence, input.player, false)),
  };

  const players = new Set<string>();
  const playerValues: Record<string, Record<string, PlayerOccurrenceValues>> = {};
  for (const occurrence of input.occurrences) {
    const slices: Record<string, PlayerOccurrenceValues> = {};
    for (const player of occurrence.players) {
      players.add(player.player);
      slices[player.player] = playerSlice(occurrence, player.player);
    }
    playerValues[occurrence.key] = slices;
  }

  return {
    session: input.session,
    sessionKey: buildSessionKey(input.session),
    sessionLabel: sessionLabel(input.session),
    player: input.player,
    playerLabel: input.player ?? "Team average",
    players: [...players].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    fullTraining,
    cards,
    playerValues,
    editorOccurrences: input.occurrences
      .filter((occurrence) => !isFullTrainingDrill(occurrence.drill))
      .map((occurrence) => ({
        key: occurrence.key,
        drill: occurrence.drill,
        timeLabel: occurrence.timeLabel,
        timeUncertain: occurrence.timeUncertain,
        playerCount: occurrence.playerCount,
        hasPlayerConflict: occurrence.hasPlayerConflict,
      })),
    editorCards,
    excludedBlankDrillRows: input.excludedBlankDrillRows,
    excludedBlankPlayerRows: input.excludedBlankPlayerRows,
  };
}
