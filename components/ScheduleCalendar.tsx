"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";
import {
  getScheduleForMonth,
  addScheduleItem,
  removeScheduleItem,
  updateScheduleItemTime,
  updateScheduleItemNotes,
  updateScheduleItemMatchTeams,
} from "@/app/actions/schedule";
import type { ScheduleActivityType } from "@/lib/types";
import { getDateContextLabel } from "@/lib/dateContext";
import { ScheduleIcon } from "@/components/ScheduleIcon";
import { Trash2, X, Clock, MapPin, CalendarDays, Plus } from "lucide-react";
import { getScheduleActivityBg } from "@/components/scheduleColors";

function LocationPinIcon({ className, ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

const ACTIVITY_LABELS: Record<ScheduleActivityType, string> = {
  arrival: "Arrival",
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  training: "Training",
  gym: "Gym",
  recovery: "Recovery",
  pre_activation: "Pre-activation",
  video_analysis: "Video analysis",
  meeting: "Meeting",
  traveling: "Traveling",
  physio: "Physio",
  medical: "Medical",
  media: "Media",
  rest_off: "Rest/Off",
  match: "Match",
  team_building: "Team building",
  individual: "Individual",
};

const ACTIVITY_TYPES: ScheduleActivityType[] = [
  "arrival",
  "breakfast",
  "lunch",
  "dinner",
  "training",
  "gym",
  "recovery",
  "pre_activation",
  "video_analysis",
  "meeting",
  "traveling",
  "physio",
  "medical",
  "media",
  "rest_off",
  "match",
  "team_building",
  "individual",
];

function iconBgClass(type: ScheduleActivityType) {
  return getScheduleActivityBg(type);
}

/** First row of Add buttons (arrival, meals & core activities). */
const ADD_ROW_1: ScheduleActivityType[] = [
  "arrival",
  "breakfast",
  "lunch",
  "dinner",
  "training",
  "gym",
  "recovery",
  "pre_activation",
  "video_analysis",
  "meeting",
];
/** Second row (travel, health, match, etc.). */
const ADD_ROW_2: ScheduleActivityType[] = [
  "traveling",
  "physio",
  "medical",
  "media",
  "rest_off",
  "match",
  "team_building",
  "individual",
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function scheduleListNeonStyle(type: string, isMatch: boolean) {
  if (isMatch || type === "match") {
    return {
      backgroundImage:
        "radial-gradient(circle at left, rgba(251, 191, 36, 0.26) 0, transparent 55%), linear-gradient(135deg, #141006, #0a0502)",
      boxShadow:
        "0 0 0 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(251, 191, 36, 0.2), 0 5px 16px rgba(180, 83, 9, 0.08)",
      borderRadius: 12,
    };
  }

  const glowByType: Record<string, string> = {
    breakfast: "rgba(252, 211, 77, 0.30)",
    lunch: "rgba(252, 211, 77, 0.30)",
    dinner: "rgba(252, 211, 77, 0.30)",
    arrival: "rgba(249, 115, 22, 0.30)",
    training: "rgba(16, 185, 129, 0.30)",
    gym: "rgba(132, 204, 22, 0.28)",
    recovery: "rgba(56, 189, 248, 0.30)",
    pre_activation: "rgba(245, 158, 11, 0.30)",
    video_analysis: "rgba(139, 92, 246, 0.30)",
    traveling: "rgba(245, 158, 11, 0.30)",
    physio: "rgba(56, 189, 248, 0.30)",
    medical: "rgba(244, 63, 94, 0.30)",
    meeting: "rgba(79, 70, 229, 0.30)",
    media: "rgba(217, 70, 239, 0.30)",
    team_building: "rgba(147, 51, 234, 0.30)",
    rest_off: "rgba(59, 130, 246, 0.26)",
    individual: "rgba(52, 211, 153, 0.30)",
  };

  const glow = glowByType[type] ?? "rgba(16, 185, 129, 0.26)";

  return {
    backgroundImage: `radial-gradient(circle at left, ${glow} 0, transparent 55%), linear-gradient(135deg, #041311, #020617)`,
    boxShadow:
      "0 0 0 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(16, 185, 129, 0.2), 0 5px 16px rgba(6, 95, 70, 0.08)",
    borderRadius: 12,
  };
}

function formatSheetDate(dateISO: string, todayISO: string): string {
  if (dateISO === todayISO) return "Today";
  const d = new Date(dateISO + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** Left border: only match is highlighted (amber), rest neutral. */
function scheduleRowLeftBorder(activityType: string): string {
  if (activityType === "match") return "border-l-4 border-l-amber-500/80";
  return "border-l-4 border-l-zinc-600";
}

type ScheduleItem = {
  id: string;
  date: string;
  activity_type: string;
  start_time: string | null;
  end_time: string | null;
  notes?: string | null;
  opponent?: string | null;
  team_a?: string | null;
  team_b?: string | null;
};

function formatItemLabel(item: ScheduleItem): string {
  const label = ACTIVITY_LABELS[item.activity_type as ScheduleActivityType] ?? item.activity_type;
  if (item.activity_type === "match") {
    const a = item.team_a?.trim();
    const b = item.team_b?.trim();
    if (a && b) return `${a} vs. ${b}`;
    if (item.opponent?.trim()) return `${label} vs. ${item.opponent.trim()}`;
  }
  return item.notes?.trim() ? `${label} (${item.notes.trim()})` : label;
}

function getMonthRange(year: number, month: number) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function buildCalendarGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startWeekday = first.getDay();
  const mondayFirst = startWeekday === 0 ? 6 : startWeekday - 1;
  const daysInMonth = last.getDate();

  const grid: (string | null)[][] = [];
  let row: (string | null)[] = [];
  for (let i = 0; i < mondayFirst; i++) row.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    row.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    if (row.length === 7) {
      grid.push(row);
      row = [];
    }
  }
  if (row.length) {
    while (row.length < 7) row.push(null);
    grid.push(row);
  }
  return grid;
}

export function ScheduleCalendar({ canEdit, isAdmin = false, isPlayer = false }: { canEdit: boolean; isAdmin?: boolean; isPlayer?: boolean }) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addingType, setAddingType] = useState<ScheduleActivityType | null>(null);
  const [sheetSelectedTypes, setSheetSelectedTypes] = useState<ScheduleActivityType[]>([]);
  const [addStart, setAddStart] = useState("");
  const [addEnd, setAddEnd] = useState("");
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editingNotesValue, setEditingNotesValue] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addTeamA, setAddTeamA] = useState("");
  const [addTeamB, setAddTeamB] = useState("");
  const [editingMatchTeamsId, setEditingMatchTeamsId] = useState<string | null>(null);
  const [editingTeamA, setEditingTeamA] = useState("");
  const [editingTeamB, setEditingTeamB] = useState("");
  const [timeSaveError, setTimeSaveError] = useState<string | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const { from, to } = useMemo(() => getMonthRange(year, month), [year, month]);

  useEffect(() => {
    setCopyError(null);
  }, [selectedDate]);

  useEffect(() => {
    if (addingType == null) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAddingType(null);
        setSheetSelectedTypes([]);
        setAddStart("");
        setAddEnd("");
        setAddNotes("");
        setAddTeamA("");
        setAddTeamB("");
        setTimeSaveError(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [addingType]);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    getScheduleForMonth(from, to).then(({ data, error }) => {
      if (error) {
        setLoadError(error);
        setScheduleItems([]);
      } else {
        setScheduleItems(data ?? []);
      }
      setLoading(false);
    });
  }, [from, to]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of scheduleItems) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [scheduleItems]);

  const grid = useMemo(() => buildCalendarGrid(year, month), [year, month]);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const nextSessionDate = useMemo(() => {
    const dates = [...itemsByDate.keys()].filter((d) => d >= todayISO).sort();
    return dates[0] ?? null;
  }, [itemsByDate, todayISO]);

  const nextSessionSummary = useMemo(() => {
    if (!nextSessionDate) return null;
    const items = itemsByDate.get(nextSessionDate) ?? [];
    const labels = items.map((i) => formatItemLabel(i)).join(", ");
    const d = new Date(nextSessionDate);
    const formatted = d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
    return nextSessionDate === todayISO ? `Today – ${labels}` : `${formatted} – ${labels}`;
  }, [nextSessionDate, itemsByDate]);

  const selectedItems = useMemo(() => {
    if (!selectedDate) return [];
    const items = itemsByDate.get(selectedDate) ?? [];
    return [...items].sort((a, b) => {
      const aStart = (a.start_time ?? "") as string;
      const bStart = (b.start_time ?? "") as string;
      // üresek menjenek a lista végére
      if (!aStart && !bStart) return 0;
      if (!aStart) return 1;
      if (!bStart) return -1;
      return aStart.localeCompare(bStart);
    });
  }, [itemsByDate, selectedDate]);

  function handlePrevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }

  function handleNextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  async function handleAdd(activity_type: ScheduleActivityType, startTime?: string | null, endTime?: string | null, notes?: string | null, team_a?: string | null, team_b?: string | null) {
    if (!selectedDate || !canEdit) return;
    setTimeSaveError(null);
    if (startTime != null || endTime != null) {
      const errMsg = validateTimeRange(startTime ?? "", endTime ?? "");
      if (errMsg) {
        setTimeSaveError(errMsg);
        return;
      }
    }
    setAddLoading(true);
    const err = await addScheduleItem(selectedDate, activity_type, startTime ?? null, endTime ?? null, notes ?? null, undefined, activity_type === "match" ? team_a ?? null : undefined, activity_type === "match" ? team_b ?? null : undefined);
    if (err?.error) {
      setTimeSaveError(err.error);
      setAddLoading(false);
      return;
    }
    const { data } = await getScheduleForMonth(from, to);
    setScheduleItems(data ?? []);
    setAddLoading(false);
    setAddStart("");
    setAddEnd("");
    setAddNotes("");
    setAddTeamA("");
    setAddTeamB("");
    setAddingType(null);
    setSheetSelectedTypes([]);
  }

  async function handleAddMultiple(
    types: ScheduleActivityType[],
    startTime: string | null,
    endTime: string | null,
    notes: string | null,
    team_a?: string | null,
    team_b?: string | null
  ) {
    if (!selectedDate || !canEdit || types.length === 0) return;
    setTimeSaveError(null);
    if (startTime != null || endTime != null) {
      const errMsg = validateTimeRange(startTime ?? "", endTime ?? "");
      if (errMsg) {
        setTimeSaveError(errMsg);
        return;
      }
    }
    setAddLoading(true);
    for (const activity_type of types) {
      const err = await addScheduleItem(
        selectedDate,
        activity_type,
        startTime ?? null,
        endTime ?? null,
        notes ?? null,
        undefined,
        activity_type === "match" ? team_a ?? null : undefined,
        activity_type === "match" ? team_b ?? null : undefined
      );
      if (err?.error) {
        setTimeSaveError(err.error);
        setAddLoading(false);
        return;
      }
    }
    const { data } = await getScheduleForMonth(from, to);
    setScheduleItems(data ?? []);
    setAddLoading(false);
    setAddStart("");
    setAddEnd("");
    setAddNotes("");
    setAddTeamA("");
    setAddTeamB("");
    setSheetSelectedTypes([]);
    // Sheet stays open so user can add next activity(ies) without reopening
  }

  function selectSingleSheetType(type: ScheduleActivityType) {
    setSheetSelectedTypes((prev) =>
      prev.length === 1 && prev[0] === type ? [] : [type]
    );
  }

  async function handleSaveNotes(id: string, notes: string) {
    const val = notes.trim().slice(0, 100) || null;
    await updateScheduleItemNotes(id, val);
    const { data } = await getScheduleForMonth(from, to);
    setScheduleItems(data ?? []);
    setEditingNotesId(null);
    setEditingNotesValue("");
  }

  async function handleSaveMatchTeams(id: string, team_a: string, team_b: string) {
    const a = team_a.trim().slice(0, 100) || null;
    const b = team_b.trim().slice(0, 100) || null;
    await updateScheduleItemMatchTeams(id, a, b);
    const { data } = await getScheduleForMonth(from, to);
    setScheduleItems(data ?? []);
    setEditingMatchTeamsId(null);
    setEditingTeamA("");
    setEditingTeamB("");
  }

  async function handleSetTime(id: string, startTime: string | null, endTime: string | null) {
    setTimeSaveError(null);
    if (!startTime || !startTime.trim()) {
      setTimeSaveError("Start time is required.");
      return;
    }
    const errMsg = validateTimeRange(startTime, endTime ?? "");
    if (errMsg) {
      setTimeSaveError(errMsg);
      return;
    }
    const err = await updateScheduleItemTime(id, startTime.trim(), endTime?.trim() || null);
    if (err.error) {
      setTimeSaveError(err.error);
      return;
    }
    const { data } = await getScheduleForMonth(from, to);
    setScheduleItems(data);
    setEditingTimeId(null);
    setEditStart("");
    setEditEnd("");
  }

  /** Parse and validate 24h HH:MM (00–23 hour, 00–59 minute). Returns normalized "HH:MM" or null. */
  function parse24hTime(raw: string): string | null {
    const t = raw.trim();
    const match = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function validateTimeRange(start: string, end: string): string | null {
    if (!start || !start.trim()) return "Start time is required.";
    const s = parse24hTime(start);
    const e = end.trim() ? parse24hTime(end) : null;
    if (!s) return "Start time must be HH:MM (24h, 00:00–23:59).";
    if (e !== null && e <= s) return "End time must be after start time.";
    if (e === null && end.trim()) return "End time must be HH:MM (24h, 00:00–23:59).";
    return null;
  }

  async function handleRemove(id: string) {
    if (!canEdit) return;
    await removeScheduleItem(id);
    setScheduleItems((prev) => prev.filter((i) => i.id !== id));
  }

  function getYesterday(date: string): string {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  async function handleCopyFromYesterday() {
    if (!selectedDate || !canEdit) return;
    setCopyError(null);
    const yesterday = getYesterday(selectedDate);
    const sourceItems = itemsByDate.get(yesterday) ?? [];
    if (sourceItems.length === 0) {
      setCopyError("No items to copy from yesterday.");
      return;
    }
    setCopyLoading(true);
    for (const item of sourceItems) {
      const startTime = item.start_time != null && String(item.start_time).trim() !== "" ? String(item.start_time).trim().slice(0, 5) : null;
      const endTime = item.end_time != null && String(item.end_time).trim() !== "" ? String(item.end_time).trim().slice(0, 5) : null;
      const err = await addScheduleItem(
        selectedDate,
        item.activity_type as ScheduleActivityType,
        startTime,
        endTime,
        item.notes ?? null,
        item.opponent ?? null,
        item.team_a ?? null,
        item.team_b ?? null
      );
      if (err?.error) {
        setCopyError(err.error);
        setCopyLoading(false);
        return;
      }
    }
    const { data } = await getScheduleForMonth(from, to);
    setScheduleItems(data ?? []);
    setCopyLoading(false);
  }

  const monthLabel = new Date(year, month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      {!canEdit && !isPlayer && (
        <div
          className={`rounded-xl border px-3 py-2.5 ${themeId === "neon" ? "neon-card-text border-white/20" : themeId === "matt" ? "matt-card-text border-white/20" : ""}`}
          style={{ borderRadius: 12, ...(themeId === "neon" ? NEON_CARD_STYLE : themeId === "matt" ? MATT_CARD_STYLE : { backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }) }}
        >
          <p className={`text-xs font-medium ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>Next session</p>
          <p className="mt-0.5 text-sm font-semibold text-white">
            {nextSessionSummary ?? "No upcoming sessions"}
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex min-h-10 items-center justify-between gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-medium text-white ${isHighContrast ? "border-white/20 bg-white/10 hover:bg-white/15" : "border-zinc-700 bg-zinc-800 hover:bg-zinc-700"}`}
          >
            ← Prev
          </button>
          <span className="flex-1 shrink-0 text-center text-sm font-semibold text-white">{monthLabel}</span>
          <button
            type="button"
            onClick={handleNextMonth}
            className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-medium text-white ${isHighContrast ? "border-white/20 bg-white/10 hover:bg-white/15" : "border-zinc-700 bg-zinc-800 hover:bg-zinc-700"}`}
          >
            Next →
          </button>
        </div>

        <div
          className={`overflow-x-auto rounded-xl border ${themeId === "neon" ? "neon-card-text border-white/20" : themeId === "matt" ? "matt-card-text border-white/20" : ""}`}
          style={{ borderRadius: 12, ...(themeId === "neon" ? NEON_CARD_STYLE : themeId === "matt" ? MATT_CARD_STYLE : { backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }) }}
        >
        <table className="w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr className={isHighContrast ? "border-b border-white/20" : "border-b border-zinc-700"}>
              {WEEKDAYS.map((d) => (
                <th key={d} className={`px-1 py-2 sm:px-2 sm:py-2.5 text-center font-medium ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, ri) => (
              <tr key={ri}>
                {row.map((date, ci) => {
                  const items = date ? itemsByDate.get(date) ?? [] : [];
                  const isSelected = date === selectedDate;
                  const isToday = date === todayISO;
                  const isNextSession = date === nextSessionDate && date !== todayISO;
                  const dayClass = isSelected
                    ? "bg-emerald-600/30 ring-2 ring-emerald-500"
                    : isToday
                      ? "bg-amber-500/15 ring-2 ring-amber-400"
                      : isNextSession
                        ? "bg-emerald-500/15 ring-2 ring-emerald-400"
                        : isHighContrast ? "hover:bg-white/10" : "hover:bg-zinc-800";
                  return (
                    <td
                      key={ci}
                      className={`border-b p-1 sm:p-1.5 ${isHighContrast ? "border-white/10" : "border-zinc-800"}`}
                    >
                      {date ? (
                        <button
                          type="button"
                          onClick={() => setSelectedDate(date)}
                          className={`flex h-12 sm:h-14 w-full flex-col items-center justify-center rounded-md text-center transition ${dayClass}`}
                        >
                          <span className={`text-xs font-medium tabular-nums ${isToday ? "text-amber-300" : isHighContrast ? "text-white/90" : "text-zinc-300"}`}>
                            {date.slice(8)}
                            {isToday && <span className="ml-0.5 text-[10px] text-amber-400">Today</span>}
                          </span>
                          {items.length > 0 && (
                            <span className="mt-0.5 text-[10px] sm:text-xs text-emerald-400">
                              {items.length}
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="h-12 sm:h-14" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 mb-4" style={{ borderRadius: 12 }}>
          <p className="text-sm font-medium text-red-400">Something went wrong</p>
          <p className="mt-1 text-sm text-zinc-400">{loadError}</p>
        </div>
      )}
      {loading && <p className={`text-sm ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>Loading…</p>}

      {selectedDate && (
        <div
          className={`min-w-0 rounded-xl border p-4 ${themeId === "neon" ? "neon-card-text border-white/20" : themeId === "matt" ? "matt-card-text border-white/20" : ""}`}
          style={{ borderRadius: 12, ...(themeId === "neon" ? NEON_CARD_STYLE : themeId === "matt" ? MATT_CARD_STYLE : { backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }) }}
        >
          <h2 className="mb-3 text-base sm:text-lg font-semibold text-white">
            Program for {selectedDate}{getDateContextLabel(selectedDate)}
          </h2>
          {timeSaveError && (
            <p className="mb-2 text-xs text-red-400">{timeSaveError}</p>
          )}
          {selectedItems.length === 0 && (
            <div className="mb-3 rounded-lg border border-zinc-700/60 bg-zinc-800/50 px-3 py-3">
              <p className="text-xs sm:text-sm text-zinc-300">No program for this day.</p>
              {canEdit && (() => {
                const yesterday = getYesterday(selectedDate!);
                const yesterdayItems = itemsByDate.get(yesterday) ?? [];
                return (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyFromYesterday}
                      disabled={copyLoading || yesterdayItems.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {copyLoading ? "Copying…" : yesterdayItems.length > 0 ? `Copy from yesterday (${yesterdayItems.length})` : "Copy from yesterday"}
                    </button>
                    {copyError && <p className="text-xs text-red-400">{copyError}</p>}
                  </div>
                );
              })()}
            </div>
          )}
          <ul className="space-y-4">
            {selectedItems.map((item) => {
              const start = item.start_time != null ? String(item.start_time).slice(0, 5) : null;
              const end = item.end_time != null ? String(item.end_time).slice(0, 5) : null;
              const timeStr =
                start != null
                  ? end != null
                    ? `${start} – ${end}`
                    : start
                  : null;
              const isEditing = editingTimeId === item.id;
              const leftBorder = scheduleRowLeftBorder(item.activity_type);
              return (
                <li
                  key={item.id}
                  className={`grid grid-cols-[1fr_minmax(6rem,1.5fr)_auto] gap-2 items-center rounded-lg border border-zinc-700/60 px-3 py-2.5 shadow-sm ${leftBorder} ${
                    themeId === "neon"
                      ? "text-white"
                      : isHighContrast
                        ? "bg-white/5 text-white/90"
                        : `${getScheduleActivityBg(item.activity_type)} text-zinc-200`
                  }`}
                  style={themeId === "neon" ? scheduleListNeonStyle(item.activity_type, item.activity_type === "match") : undefined}
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium text-white text-xs">
                      {item.activity_type !== "match" && (
                        <span
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 ${getScheduleActivityBg(
                            item.activity_type,
                          )}`}
                        >
                          <ScheduleIcon type={item.activity_type} className="h-5 w-5 shrink-0" />
                        </span>
                      )}
                      <span>
                        {item.activity_type === "match"
                        ? (item.team_a?.trim() && item.team_b?.trim()
                          ? `${item.team_a.trim()} vs. ${item.team_b.trim()}`
                          : item.opponent?.trim()
                            ? `Match vs. ${item.opponent.trim()}`
                            : "Match")
                        : (ACTIVITY_LABELS[item.activity_type as ScheduleActivityType] ?? item.activity_type)}
                      </span>
                    </p>
                    {item.activity_type === "match" && isAdmin && (
                      editingMatchTeamsId === item.id ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={editingTeamA}
                            onChange={(e) => setEditingTeamA(e.target.value)}
                            placeholder="Team A"
                            maxLength={100}
                            className="w-32 rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm text-white placeholder-zinc-500"
                          />
                          <span className="text-zinc-500 text-sm">vs.</span>
                          <input
                            type="text"
                            value={editingTeamB}
                            onChange={(e) => setEditingTeamB(e.target.value)}
                            placeholder="Team B"
                            maxLength={100}
                            className="w-32 rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm text-white placeholder-zinc-500"
                          />
                          <button type="button" onClick={() => handleSaveMatchTeams(item.id, editingTeamA, editingTeamB)} className="text-emerald-400 hover:text-emerald-300 text-sm">Save</button>
                          <button type="button" onClick={() => { setEditingMatchTeamsId(null); setEditingTeamA(""); setEditingTeamB(""); }} className="text-zinc-400 hover:text-zinc-300 text-sm">Cancel</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setEditingMatchTeamsId(item.id); setEditingTeamA(item.team_a ?? ""); setEditingTeamB(item.team_b ?? ""); }}
                          className="text-xs text-amber-400 hover:text-amber-300"
                        >
                          {(item.team_a?.trim() && item.team_b?.trim()) ? `Edit teams` : "Set teams"}
                        </button>
                      )
                    )}
                    {item.notes?.trim() ? (
                      <p
                        className={`flex cursor-pointer items-center gap-1 text-[10px] sm:text-xs ${
                          isHighContrast ? "text-white/80" : "text-zinc-400"
                        }`}
                        onClick={() => {
                          if (!isAdmin || isEditing) return;
                          setEditingNotesId(item.id);
                          setEditingNotesValue(item.notes ?? "");
                        }}
                      >
                        <LocationPinIcon
                          className={`h-3 w-3 shrink-0 ${
                            isHighContrast ? "text-white/60" : "text-zinc-500"
                          }`}
                        />
                        {item.notes.trim()}
                      </p>
                    ) : null}
                    <p
                      className={`text-[10px] sm:text-xs tabular-nums tracking-[0.03em] ${
                        timeStr != null
                          ? isHighContrast
                            ? "text-emerald-300/90"
                            : "text-emerald-400/90"
                          : isHighContrast
                            ? "text-white/80"
                            : "text-zinc-400"
                      } ${isAdmin && !isEditing && timeStr != null ? "cursor-pointer" : ""}`}
                      onClick={() => {
                        if (!isAdmin || isEditing || timeStr == null) return;
                        setEditingTimeId(item.id);
                        setEditStart(start ?? "");
                        setEditEnd(end ?? "");
                      }}
                    >
                      {timeStr != null ? (
                        <>
                          {start}
                          {end != null ? <span className="inline-block px-1.5">–</span> : null}
                          {end != null ? end : null}
                        </>
                      ) : isAdmin && !isEditing ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTimeId(item.id);
                            setEditStart("");
                            setEditEnd("");
                          }}
                          className="text-amber-400 hover:text-amber-300"
                        >
                          Set time
                        </button>
                      ) : (
                        "—"
                      )}
                    </p>
                    {isEditing && isAdmin && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2" lang="en-GB">
                        <input
                          type="time"
                          step="60"
                          value={editStart}
                          onChange={(e) => setEditStart(e.target.value)}
                          className="rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm text-white"
                          aria-label="Start time (24h)"
                          title="24h format, e.g. 09:00 or 14:30"
                        />
                        <input
                          type="time"
                          step="60"
                          value={editEnd}
                          onChange={(e) => setEditEnd(e.target.value)}
                          className="rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm text-white"
                          aria-label="End time (24h)"
                          title="24h format, e.g. 09:00 or 14:30"
                        />
                        <button
                          type="button"
                          onClick={() => handleSetTime(item.id, editStart || null, editEnd || null)}
                          className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingTimeId(null); setEditStart(""); setEditEnd(""); }}
                          className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-center min-w-0">
                    {isAdmin && editingNotesId === item.id ? (
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <span className="flex items-center gap-1.5 rounded border border-zinc-600 bg-zinc-900 px-2 py-1">
                          <LocationPinIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                          <input
                            type="text"
                            value={editingNotesValue}
                            onChange={(e) => setEditingNotesValue(e.target.value)}
                            placeholder="Location (e.g. Room #4, Arena bistro)"
                            maxLength={100}
                            className="w-32 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
                          />
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSaveNotes(item.id, editingNotesValue)}
                          className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingNotesId(null); setEditingNotesValue(""); }}
                          className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : isAdmin && !isEditing ? (
                      <button
                        type="button"
                        onClick={() => { setEditingNotesId(item.id); setEditingNotesValue(item.notes ?? ""); }}
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-400"
                      >
                        <LocationPinIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        Location
                      </button>
                    ) : null}
                  </div>
                  <div className="flex justify-end shrink-0">
                    {canEdit && !isEditing && (
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        className="rounded-md bg-red-500/20 p-1 text-red-400 hover:bg-red-500/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        <span className="sr-only">Remove</span>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {canEdit && (
            <div className="mt-4 rounded-lg border border-zinc-700/80 bg-zinc-800/60 px-4 py-3">
              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium text-zinc-300">Add:</span>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Meals & training</span>
                  <div className="flex flex-wrap gap-2">
                    {ADD_ROW_1.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => (isAdmin ? (setAddingType(type), setSheetSelectedTypes([type])) : handleAdd(type))}
                        disabled={addLoading}
                        className="flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800/90 px-3 py-1.5 text-sm text-white hover:border-emerald-500/50 hover:bg-emerald-500/15 disabled:opacity-50"
                      >
                        {ACTIVITY_LABELS[type]}
                        <span className={`inline-flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded-md border border-white/10 ${iconBgClass(type)}`}>
                          <ScheduleIcon type={type} className="h-5 w-5 sm:h-7 sm:w-7 shrink-0" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 border-t border-zinc-700/80 pt-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Other</span>
                  <div className="flex flex-wrap gap-2">
                    {ADD_ROW_2.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => (isAdmin ? (setAddingType(type), setSheetSelectedTypes([type])) : handleAdd(type))}
                        disabled={addLoading}
                        className="flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800/90 px-3 py-1.5 text-sm text-white hover:border-emerald-500/50 hover:bg-emerald-500/15 disabled:opacity-50"
                      >
                        {ACTIVITY_LABELS[type]}
                        <span className={`inline-flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded-md border border-white/10 ${iconBgClass(type)}`}>
                          <ScheduleIcon type={type} className="h-5 w-5 sm:h-7 sm:w-7 shrink-0" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Add program sheet – opens when admin selects an activity type; portal so mobile top is visible */}
          {addingType != null && isAdmin && selectedDate && (() => {
            const addSheet = (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black touch-none overflow-hidden"
                  aria-hidden
                  onClick={() => { setAddingType(null); setSheetSelectedTypes([]); setAddStart(""); setAddEnd(""); setAddNotes(""); setAddTeamA(""); setAddTeamB(""); setTimeSaveError(null); }}
                />
                <div
                  className={`schedule-add-sheet-panel fixed left-0 right-0 z-50 flex flex-col overflow-hidden rounded-t-2xl border-2 shadow-2xl top-4 bottom-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:right-auto sm:max-h-[min(900px,94vh)] sm:w-full sm:max-w-7xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl ${themeId === "neon" ? "border-emerald-500/40 neon-card-text" : themeId === "matt" ? "border-white/25 matt-card-text" : "border-white/30"}`}
                style={{
                  paddingBottom: "env(safe-area-inset-bottom, 0px)",
                  borderRadius: 12,
                  ...(themeId === "neon"
                    ? NEON_CARD_STYLE
                    : themeId === "matt"
                      ? MATT_CARD_STYLE
                      : { backgroundColor: "var(--card-bg)" }),
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-program-sheet-title"
              >
                <div className={`flex items-center justify-between rounded-t-2xl border-b px-4 py-2.5 shrink-0 ${themeId === "neon" ? "border-emerald-500/30 bg-white/[0.04]" : themeId === "matt" ? "border-white/20 bg-white/[0.06]" : "border-white/10 bg-zinc-900/40"}`}>
                  <h2 id="add-program-sheet-title" className="text-xl font-semibold text-white">
                    Program · {formatSheetDate(selectedDate, todayISO)}
                  </h2>
                  <button
                    type="button"
                    onClick={() => { setAddingType(null); setSheetSelectedTypes([]); setAddStart(""); setAddEnd(""); setAddNotes(""); setAddTeamA(""); setAddTeamB(""); setTimeSaveError(null); }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
                    aria-label="Close"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div
                  className="flex-1 overflow-y-auto pt-2.5 px-4 space-y-4 min-h-0"
                  style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 0px))" }}
                  lang="en-GB"
                >
                  {timeSaveError && <p className="text-sm text-red-400">{timeSaveError}</p>}

                  <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-white">
                      <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                      Activities
                    </p>
                    <div className="flex flex-col gap-2 sm:gap-3">
                      <div>
                        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 sm:mb-1.5">Meals & training</span>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {ADD_ROW_1.map((type) => {
                            const selected = sheetSelectedTypes.includes(type);
                            return (
                              <button
                                key={type}
                                type="button"
                                onClick={() => selectSingleSheetType(type)}
                                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-base ${
                                  selected
                                    ? "border-emerald-500/70 bg-emerald-500/25 text-white shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
                                    : "border-zinc-600 bg-zinc-800/80 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700/80"
                                }`}
                              >
                                <span className={`inline-flex items-center justify-center h-9 w-9 rounded-md border border-white/10 sm:h-10 sm:w-10 ${iconBgClass(type)}`}>
                                  <ScheduleIcon type={type} className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" />
                                </span>
                                <span>{ACTIVITY_LABELS[type]}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 sm:mb-1.5">Other</span>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {ADD_ROW_2.map((type) => {
                            const selected = sheetSelectedTypes.includes(type);
                            return (
                              <button
                                key={type}
                                type="button"
                                onClick={() => selectSingleSheetType(type)}
                                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-base ${
                                  selected
                                    ? "border-emerald-500/70 bg-emerald-500/25 text-white shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
                                    : "border-zinc-600 bg-zinc-800/80 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700/80"
                                }`}
                              >
                                <span className={`inline-flex items-center justify-center h-9 w-9 rounded-md border border-white/10 sm:h-10 sm:w-10 ${iconBgClass(type)}`}>
                                  <ScheduleIcon type={type} className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" />
                                </span>
                                <span>{ACTIVITY_LABELS[type]}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <p className="flex items-center gap-2 text-sm font-medium text-white">
                      <Clock className="h-4 w-4 shrink-0" aria-hidden />
                      Time
                    </p>
                    <div className="flex flex-wrap items-end gap-3 rounded-xl border-2 border-white/25 bg-zinc-900/60 px-4 py-3.5 shadow-inner">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm text-zinc-500">Start</span>
                        <input
                          type="time"
                          step="60"
                          value={addStart}
                          onChange={(e) => setAddStart(e.target.value)}
                          className="min-w-[9rem] rounded-lg border border-white/20 bg-zinc-900 px-3.5 py-3 text-base text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          aria-label="Start time (24h)"
                          title="24h, e.g. 09:00"
                        />
                      </label>
                      <span className="text-zinc-500 pb-3">–</span>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm text-zinc-500">End</span>
                        <input
                          type="time"
                          step="60"
                          value={addEnd}
                          onChange={(e) => setAddEnd(e.target.value)}
                          className="min-w-[9rem] rounded-lg border border-white/20 bg-zinc-900 px-3.5 py-3 text-base text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          aria-label="End time (24h)"
                          title="24h, e.g. 14:30"
                        />
                      </label>
                    </div>
                  </div>

                  {sheetSelectedTypes.includes("match") && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm text-zinc-500">Teams (for Match)</span>
                      <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                        <input
                          type="text"
                          value={addTeamA}
                          onChange={(e) => setAddTeamA(e.target.value)}
                          placeholder="Team A"
                          maxLength={100}
                          className="min-w-0 flex-1 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-base text-white placeholder-zinc-500 sm:max-w-[12rem]"
                        />
                        <span className="text-zinc-500 text-base shrink-0">vs.</span>
                        <input
                          type="text"
                          value={addTeamB}
                          onChange={(e) => setAddTeamB(e.target.value)}
                          placeholder="Team B"
                          maxLength={100}
                          className="min-w-0 flex-1 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-base text-white placeholder-zinc-500 sm:max-w-[12rem]"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <p className="flex items-center gap-2 text-sm font-medium text-white">
                      <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                      Notes (optional)
                    </p>
                    <div className="rounded-xl border-2 border-white/25 bg-zinc-900/60 px-3.5 py-2.5 shadow-inner">
                      <input
                        type="text"
                        value={addNotes}
                        onChange={(e) => setAddNotes(e.target.value)}
                        placeholder="e.g. location"
                        maxLength={100}
                        className="w-full min-w-0 rounded-md border-0 bg-transparent px-0 py-1 text-base text-white placeholder-zinc-500 focus:outline-none focus:ring-0"
                        aria-label="Notes (max 100)"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddMultiple(sheetSelectedTypes, addStart || null, addEnd || null, addNotes.trim() || null, sheetSelectedTypes.includes("match") ? addTeamA.trim() || null : undefined, sheetSelectedTypes.includes("match") ? addTeamB.trim() || null : undefined)}
                    disabled={addLoading || sheetSelectedTypes.length === 0}
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-emerald-600 px-4 py-3.5 text-base font-medium text-white shadow-md hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-5 w-5 shrink-0" aria-hidden />
                    {addLoading ? "Adding…" : "Add"}
                  </button>
                </div>
              </div>
            </>
            );
            return typeof document !== "undefined" ? createPortal(addSheet, document.body) : null;
          })()}
        </div>
      )}
    </div>
  );
}
