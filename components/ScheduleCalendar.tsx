"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getScheduleForMonth,
  addScheduleItem,
  removeScheduleItem,
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

type ScheduleItem = { id: string; date: string; activity_type: string };

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

export function ScheduleCalendar({ canEdit }: { canEdit: boolean }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addLoading, setAddLoading] = useState(false);

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

  async function handleAdd(activity_type: ScheduleActivityType) {
    if (!selectedDate || !canEdit) return;
    setAddLoading(true);
    await addScheduleItem(selectedDate, activity_type);
    const { data } = await getScheduleForMonth(from, to);
    setScheduleItems(data);
    setAddLoading(false);
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
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white hover:bg-zinc-700"
        >
          ← Prev
        </button>
        <span className="text-lg font-semibold text-white">{monthLabel}</span>
        <button
          type="button"
          onClick={handleNextMonth}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white hover:bg-zinc-700"
        >
          Next →
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-700">
              {WEEKDAYS.map((d) => (
                <th key={d} className="p-2 text-center font-medium text-zinc-400">
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
                  return (
                    <td
                      key={ci}
                      className="border-b border-zinc-800 p-1"
                    >
                      {date ? (
                        <button
                          type="button"
                          onClick={() => setSelectedDate(date)}
                          className={`flex h-14 w-full flex-col items-center justify-center rounded-lg text-center transition ${
                            isSelected
                              ? "bg-emerald-600/30 ring-2 ring-emerald-500"
                              : "hover:bg-zinc-800"
                          }`}
                        >
                          <span className="text-zinc-300">{date.slice(8)}</span>
                          {items.length > 0 && (
                            <span className="mt-0.5 text-xs text-emerald-400">
                              {items.length} item{items.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="h-14" />
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
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="mb-3 font-semibold text-white">
            Program for {selectedDate}
          </h2>
          <ul className="space-y-2">
            {selectedItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2 text-zinc-200"
              >
                <span>
                  {ACTIVITY_LABELS[item.activity_type as ScheduleActivityType] ?? item.activity_type}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-zinc-400">Add:</span>
              {ACTIVITY_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleAdd(type)}
                  disabled={addLoading}
                  className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
                >
                  {ACTIVITY_LABELS[type]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
