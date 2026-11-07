export type HistoryEntry = {
  id: string;
  sessionKey: string;
  date: string;
  sessionLabel: string;
  title: string;
  setCount: number;
  /** Team duration for each set, in set order. Null when no readable duration. */
  duration: string | null;
  hasImage: boolean;
  /** Lowercase title, display name, and original drill names. */
  searchText: string;
};

/** Partial, case-insensitive match over the full catalog. An empty query returns every entry. */
export function filterHistoryEntries(entries: HistoryEntry[], query: string): HistoryEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter((entry) => entry.searchText.toLowerCase().includes(needle));
}
