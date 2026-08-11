/** Counts based only on the participant list for an opened match. */
export function matchFeedbackParticipantCounts(
  participantIds: string[],
  completedPlayerIds: Iterable<string>
): { total: number; completed: number; missing: number } {
  const completedSet = new Set(completedPlayerIds);
  let completed = 0;
  for (const id of participantIds) {
    if (completedSet.has(id)) completed += 1;
  }
  const total = participantIds.length;
  return { total, completed, missing: total - completed };
}
