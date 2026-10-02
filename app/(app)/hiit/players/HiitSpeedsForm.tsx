"use client";

import { useState } from "react";
import { saveHiitSpeeds } from "@/app/actions/hiit";
import { asrKmh, round1 } from "@/lib/hiit/calc";
import type { HiitSpeedRow } from "@/lib/hiit/load.server";

export function HiitSpeedsForm({ initialRows }: { initialRows: HiitSpeedRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update(playerId: string, field: "masKmh" | "mssKmh", value: string) {
    setRows((current) => current.map((row) => (row.playerId === playerId ? { ...row, [field]: value } : row)));
  }

  async function onSave() {
    setMessage(null);
    const payload: { playerId: string; masKmh: number; mssKmh: number }[] = [];
    for (const row of rows) {
      const masText = row.masKmh.trim();
      const mssText = row.mssKmh.trim();
      if (!masText && !mssText) continue;
      const mas = Number(masText);
      const mss = Number(mssText);
      if (asrKmh(mas, mss) == null) {
        setMessage(`${row.name}: MSS must be greater than MAS. Both are km/h.`);
        return;
      }
      payload.push({ playerId: row.playerId, masKmh: mas, mssKmh: mss });
    }
    setPending(true);
    const result = await saveHiitSpeeds(payload);
    setPending(false);
    setMessage(result.error ?? "Saved.");
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-[640px] w-full text-left text-sm">
          <thead className="bg-zinc-900/80 text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="px-3 py-3">Player</th>
              <th className="px-3 py-3">MAS km/h</th>
              <th className="px-3 py-3">MSS km/h</th>
              <th className="px-3 py-3">ASR km/h</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const asr = asrKmh(Number(row.masKmh), Number(row.mssKmh));
              return (
                <tr key={row.playerId} className="border-t border-white/10">
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2">
                    <input
                      inputMode="decimal"
                      value={row.masKmh}
                      onChange={(event) => update(row.playerId, "masKmh", event.target.value)}
                      className="h-11 w-28 rounded-lg border border-white/15 bg-black/30 px-3"
                      aria-label={`${row.name} MAS`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      inputMode="decimal"
                      value={row.mssKmh}
                      onChange={(event) => update(row.playerId, "mssKmh", event.target.value)}
                      className="h-11 w-28 rounded-lg border border-white/15 bg-black/30 px-3"
                      aria-label={`${row.name} MSS`}
                    />
                  </td>
                  <td className="px-3 py-2 tabular-nums text-emerald-300">{asr == null ? "—" : round1(asr)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="h-11 rounded-lg bg-emerald-500 px-4 font-medium text-black disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save speeds"}
        </button>
        {message ? <p className="text-sm text-zinc-300">{message}</p> : null}
      </div>
    </div>
  );
}
