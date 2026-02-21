"use client";

import { useState } from "react";
import { setAvailability, clearAvailability } from "@/app/actions/availability";
import type { AvailabilityStatus } from "@/lib/types";

const OPTIONS: { value: AvailabilityStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "injured", label: "Injured" },
  { value: "unavailable", label: "Unavailable" },
];

export function AvailabilityPerDay({
  userId,
  dates,
  initialByDate,
}: {
  userId: string;
  dates: string[];
  initialByDate: Record<string, string>;
}) {
  const [byDate, setByDate] = useState<Record<string, string>>(initialByDate);
  const [saving, setSaving] = useState<string | null>(null);

  async function handleChange(date: string, value: string) {
    setSaving(date);
    if (value === "") {
      setByDate((prev) => {
        const next = { ...prev };
        delete next[date];
        return next;
      });
      await clearAvailability(userId, date);
    } else {
      const status = value as AvailabilityStatus;
      setByDate((prev) => ({ ...prev, [date]: status }));
      await setAvailability(userId, date, status);
    }
    setSaving(null);
  }

  return (
    <div className="space-y-2">
      {dates.map((date) => (
        <div key={date} className="flex items-center gap-4">
          <span className="w-28 shrink-0 text-sm text-zinc-300">{date}</span>
          <select
            value={byDate[date] ?? ""}
            onChange={(e) => handleChange(date, e.target.value)}
            disabled={!!saving}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            <option value="">—</option>
            {OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {saving === date && <span className="text-xs text-zinc-500">Saving…</span>}
        </div>
      ))}
    </div>
  );
}
