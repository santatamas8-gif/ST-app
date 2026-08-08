/** Pure helpers for Power BI player-name candidate merging (safe for unit tests). */

export type PowerBiPlayerCandidate = {
  /** Exact semantic-model Player string (preserve internal spacing/case). */
  playerName: string;
  hasTrainingData: boolean;
  hasMatchBest: boolean;
};

/**
 * Merge exact GPS_Log and Match_Benchmark (single-match best) player names.
 * Empty/whitespace-only names are dropped. Exact string equality for keys
 * (do not collapse internal double spaces).
 */
export function mergePowerBiPlayerCandidates(
  gpsLogPlayers: readonly string[],
  matchBestPlayers: readonly string[]
): PowerBiPlayerCandidate[] {
  const byName = new Map<string, PowerBiPlayerCandidate>();

  for (const raw of gpsLogPlayers) {
    const playerName = typeof raw === "string" ? raw : "";
    if (playerName.trim().length === 0) continue;
    const existing = byName.get(playerName);
    if (existing) {
      existing.hasTrainingData = true;
    } else {
      byName.set(playerName, {
        playerName,
        hasTrainingData: true,
        hasMatchBest: false,
      });
    }
  }

  for (const raw of matchBestPlayers) {
    const playerName = typeof raw === "string" ? raw : "";
    if (playerName.trim().length === 0) continue;
    const existing = byName.get(playerName);
    if (existing) {
      existing.hasMatchBest = true;
    } else {
      byName.set(playerName, {
        playerName,
        hasTrainingData: false,
        hasMatchBest: true,
      });
    }
  }

  return [...byName.values()].sort((a, b) =>
    a.playerName.localeCompare(b.playerName, undefined, { sensitivity: "variant" })
  );
}

export function extractPlayerNamesFromRows(
  rows: Record<string, unknown>[],
  pickValue: (row: Record<string, unknown>, column: string) => unknown
): string[] {
  const names: string[] = [];
  for (const row of rows) {
    const value = pickValue(row, "Player");
    if (typeof value === "string") names.push(value);
  }
  return names;
}

/**
 * Resolve a requested mapping name to an exact Power BI candidate.
 * Prefer exact `playerName` equality. Accidental outer whitespace on the
 * *request* may be used for lookup only; the returned `playerName` is always
 * the unmodified semantic-model string (never a trimmed reconstruction).
 */
export function resolvePowerBiPlayerCandidate(
  requested: string,
  candidates: readonly PowerBiPlayerCandidate[]
): PowerBiPlayerCandidate | null {
  const exact = candidates.find((c) => c.playerName === requested);
  if (exact) return exact;

  const trimmedRequest = requested.trim();
  if (trimmedRequest.length === 0 || trimmedRequest === requested) {
    return null;
  }
  return candidates.find((c) => c.playerName === trimmedRequest) ?? null;
}
