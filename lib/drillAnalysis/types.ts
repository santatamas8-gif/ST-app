/** Single-club GPS semantic model scope. This app has one team settings row. */
export const DRILL_ANALYSIS_SCOPE = "gps_log";

export const FULL_TRAINING_DRILL = "Full Training";

export const DRILL_METRICS = [
  { key: "totalDistance", label: "Total Distance", unit: "m" },
  { key: "tempoDistance", label: "Tempo Distance", unit: "m" },
  { key: "hsr", label: "HSR", unit: "m" },
  { key: "sprintDistance", label: "Sprint Distance", unit: "m" },
  { key: "distancePerMin", label: "Distance/Min", unit: "m" },
  { key: "accelerations", label: "Accelerations", unit: "count" },
  { key: "decelerations", label: "Decelerations", unit: "count" },
] as const;

export type DrillMetricKey = (typeof DRILL_METRICS)[number]["key"];
export type DrillMetricUnit = (typeof DRILL_METRICS)[number]["unit"];

export type DrillMetrics = Record<DrillMetricKey, number | null>;

export type SessionRef = {
  date: string;
  weekId: string;
  mdTag: string;
  sessionType: string;
};

export type ParsedDrillRow = {
  player: string;
  drill: string;
  startToken: string;
  startLabel: string;
  startParsed: boolean;
  /** GPS_Log[Duration] in seconds. Null when the source value is missing or unreadable. */
  durationSeconds: number | null;
  metrics: DrillMetrics;
  sourceRows: number;
};

export type DrillOccurrence = {
  key: string;
  drill: string;
  /** cohort = one participation, even if a few start times differ. start = a repeated bout. */
  identity: "cohort" | "start";
  timeLabel: string;
  /** Earliest parsed HH:MM:SS. Display labels are not used for order. */
  sortTime: string | null;
  timeUncertain: boolean;
  playerCount: number;
  sourceRowCount: number;
  hasPlayerConflict: boolean;
  players: { player: string; metrics: DrillMetrics; durationSeconds: number | null }[];
};

export type SavedDrillCard = {
  id: string;
  displayName: string;
  sortIndex: number;
  imagePath: string | null;
  occurrenceKeys: string[];
};

/** One player's rounded values for a single source occurrence. */
export type PlayerOccurrenceValues = {
  metrics: DrillMetrics;
  durationMinutes: number | null;
};

export type DrillColumn = {
  label: string;
  occurrenceKey: string;
  timeLabel: string;
  uncertain: boolean;
  missing: boolean;
  hasPlayerConflict: boolean;
  /** Null only when no player has a readable duration. Outliers do not blank it. */
  durationMinutes: number | null;
  metrics: DrillMetrics;
};

export type DrillViewCard = {
  id: string;
  displayName: string;
  persisted: boolean;
  hasImage: boolean;
  columns: DrillColumn[];
  missingCount: number;
};

export type FullTrainingView = {
  status: "ready" | "missing" | "repeated";
  columns: DrillColumn[];
};

export type EditorOccurrence = {
  key: string;
  drill: string;
  timeLabel: string;
  timeUncertain: boolean;
  playerCount: number;
  hasPlayerConflict: boolean;
};

export type EditorCard = {
  id: string;
  displayName: string;
  hasImage: boolean;
  occurrenceKeys: string[];
};

export type DrillAnalysisModel = {
  session: SessionRef;
  sessionKey: string;
  sessionLabel: string;
  player: string | null;
  playerLabel: string;
  players: string[];
  fullTraining: FullTrainingView;
  cards: DrillViewCard[];
  /** Individual rounded values keyed by occurrence, then player. Team averages are not stored here. */
  playerValues: Record<string, Record<string, PlayerOccurrenceValues>>;
  editorOccurrences: EditorOccurrence[];
  editorCards: EditorCard[];
  excludedBlankDrillRows: number;
  excludedBlankPlayerRows: number;
};

export type SessionListItem = {
  key: string;
  date: string;
  label: string;
  weekId: string;
  mdTag: string;
  sessionType: string;
};

export type DrillAnalysisPageData = {
  dates: string[];
  sessions: SessionListItem[];
  selectedDate: string | null;
  selectedSessionKey: string | null;
  selectedPlayer: string | null;
  model: DrillAnalysisModel | null;
  sourceError: string | null;
  layoutError: string | null;
  playerError: string | null;
};

export type LayoutCardInput = {
  displayName: string;
  occurrenceKeys: string[];
  previousCardId: string | null;
  keepImage: boolean;
};
