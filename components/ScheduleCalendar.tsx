"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getScheduleForMonth,
  addScheduleItem,
  removeScheduleItem,
  updateScheduleItemTime,
} from "@/app/actions/schedule";
import type { ScheduleActivityType } from "@/lib/types";

const ACTIVITY_LABELS: Record<ScheduleActivityType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  training: "Training",
  gym: "Gym",
  recovery: "Recovery",
  pre_activation: "Pre-activation",
};

const ACTIVITY_TYPES: ScheduleActivityType[] = [
  "breakfast",
  "lunch",
  "dinner",
  "training",
  "gym",
  "recovery",
  "pre_activation",
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ScheduleItem = {
  id: string;
  date: string;
  activity_type: string;
  start_time: string | null;
  end_time: string | null;
};

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

export function ScheduleCalendar({ canEdit, isAdmin = false }: { canEdit: boolean; isAdmin?: boolean }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addLoading, setAddLoading] = useState(false);
  const [addingType, setAddingType] = useState<ScheduleActivityType | null>(null);
  const [addStart, setAddStart] = useState("");
  const [addEnd, setAddEnd] = useState("");
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [timeSaveError, setTimeSaveError] = useState<string | null>(null);

  const { from, to } = useMemo(() => getMonthRange(year, month), [year, month]);

  useEffect(() => {
    setLoading(true);
    getScheduleForMonth(from, to).then(({ data }) => {
      setScheduleItems(data);
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
    const labels = items
      .map((i) => ACTIVITY_LABELS[i.activity_type as ScheduleActivityType] ?? i.activity_type)
      .join(", ");
    const d = new Date(nextSessionDate);
    const formatted = d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
    return nextSessionDate === todayISO ? `Today – ${labels}` : `${formatted} – ${labels}`;
  }, [nextSessionDate, itemsByDate]);

  const selectedItems = selectedDate ? itemsByDate.get(selectedDate) ?? [] : [];

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

  async function handleAdd(activity_type: ScheduleActivityType, startTime?: string | null, endTime?: string | null) {
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
    await addScheduleItem(selectedDate, activity_type, startTime ?? null, endTime ?? null);
    const { data } = await getScheduleForMonth(from, to);
    setScheduleItems(data);
    setAddLoading(false);
    setAddingType(null);
    setAddStart("");
    setAddEnd("");
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

  const monthLabel = new Date(year, month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      {!canEdit && (
        <div className="rounded-xl border border-zinc-800 px-4 py-3" style={{ backgroundColor: "#11161c", borderRadius: 12 }}>
          <p className="text-sm font-medium text-zinc-400">Next session</p>
          <p className="mt-1 text-base font-semibold text-white">
            {nextSessionSummary ?? "No upcoming sessions"}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          ← Prev
        </button>
        <span className="text-lg font-semibold text-white">{monthLabel}</span>
        <button
          type="button"
          onClick={handleNextMonth}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Next →
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800" style={{ backgroundColor: "#11161c", borderRadius: 12 }}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-700">
              {WEEKDAYS.map((d) => (
                <th key={d} className="px-2 py-3 text-center font-medium text-zinc-400">
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
                        : "hover:bg-zinc-800";
                  return (
                    <td
                      key={ci}
                      className="border-b border-zinc-800 p-2"
                    >
                      {date ? (
                        <button
                          type="button"
                          onClick={() => setSelectedDate(date)}
                          className={`flex h-16 w-full flex-col items-center justify-center rounded-lg text-center transition ${dayClass}`}
                        >
                          <span className={`text-sm font-medium ${isToday ? "text-amber-300" : "text-zinc-300"}`}>
                            {date.slice(8)}
                            {isToday && <span className="ml-1 text-xs text-amber-400">Today</span>}
                          </span>
                          {items.length > 0 && (
                            <span className="mt-1 text-xs text-emerald-400">
                              {items.length} item{items.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="h-16" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}

      {selectedDate && (
        <div className="rounded-xl border border-zinc-800 p-5" style={{ backgroundColor: "#11161c", borderRadius: 12 }}>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Program for {selectedDate}
          </h2>
          {timeSaveError && (
            <p className="mb-2 text-sm text-red-400">{timeSaveError}</p>
          )}
          <ul className="space-y-2.5">
            {selectedItems.map((item) => {
              const start = item.start_time != null ? String(item.start_time).slice(0, 5) : null;
              const end = item.end_time != null ? String(item.end_time).slice(0, 5) : null;
              const timeStr =
                start != null
                  ? end != null
                    ? `${start}–${end}`
                    : start
                  : null;
              const isEditing = editingTimeId === item.id;
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-zinc-200"
                >
                  <span>
                    {ACTIVITY_LABELS[item.activity_type as ScheduleActivityType] ?? item.activity_type}
                    {timeStr != null ? (
                      <span className="ml-2 text-sm text-zinc-400">{timeStr}</span>
                    ) : isAdmin && !isEditing ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTimeId(item.id);
                          setEditStart("");
                          setEditEnd("");
                        }}
                        className="ml-2 text-xs text-amber-400 hover:text-amber-300"
                      >
                        Set time
                      </button>
                    ) : (
                      <span className="ml-2 text-sm text-zinc-500">—</span>
                    )}
                  </span>
                  {isEditing && isAdmin && (
                    <div className="flex flex-wrap items-center gap-2" lang="en-GB">
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
                  {canEdit && !isEditing && (
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {canEdit && (
            <div className="mt-4 flex flex-wrap gap-2">
              {addingType == null ? (
                <>
                  <span className="text-sm text-zinc-400">Add:</span>
                  {ACTIVITY_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => (isAdmin ? setAddingType(type) : handleAdd(type))}
                      disabled={addLoading}
                      className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
                    >
                      {ACTIVITY_LABELS[type]}
                    </button>
                  ))}
                </>
              ) : isAdmin && addingType != null ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-800/80 px-3 py-2" lang="en-GB">
                  <span className="text-sm text-zinc-300">{ACTIVITY_LABELS[addingType]}</span>
                  <input
                    type="time"
                    step="60"
                    value={addStart}
                    onChange={(e) => setAddStart(e.target.value)}
                    className="rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm text-white"
                    aria-label="Start time (24h)"
                    title="24h format, e.g. 09:00 or 14:30"
                  />
                  <input
                    type="time"
                    step="60"
                    value={addEnd}
                    onChange={(e) => setAddEnd(e.target.value)}
                    className="rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm text-white"
                    aria-label="End time (24h)"
                    title="24h format, e.g. 09:00 or 14:30"
                  />
                  <button
                    type="button"
                    onClick={() => handleAdd(addingType, addStart || null, addEnd || null)}
                    disabled={addLoading}
                    className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddingType(null); setAddStart(""); setAddEnd(""); }}
                    className="rounded bg-zinc-700 px-3 py-1 text-sm text-zinc-300 hover:bg-zinc-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
