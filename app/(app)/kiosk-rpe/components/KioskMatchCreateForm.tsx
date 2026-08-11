"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { KioskPlayer } from "@/lib/players/listPlayers";
import { createMatchFeedbackMatch } from "@/lib/matchFeedback/apiClient";
import { getTeamSessionDateString } from "@/lib/kioskRpe/localDate";

type KioskMatchCreateFormProps = {
  players: KioskPlayer[];
  onCancel: () => void;
  onCreated: (matchId: string) => void;
};

export function KioskMatchCreateForm({ players, onCancel, onCreated }: KioskMatchCreateFormProps) {
  const [opponent, setOpponent] = useState("");
  const [matchDate, setMatchDate] = useState(getTeamSessionDateString());
  const [matchday, setMatchday] = useState("1");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected = selectedIds.length === players.length && players.length > 0;

  const canSubmit = useMemo(() => {
    return (
      opponent.trim().length > 0 &&
      matchDate.length > 0 &&
      Number.isInteger(Number(matchday)) &&
      Number(matchday) >= 1 &&
      selectedIds.length > 0
    );
  }, [opponent, matchDate, matchday, selectedIds]);

  function togglePlayer(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleCreate() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    const result = await createMatchFeedbackMatch({
      opponent: opponent.trim(),
      matchDate,
      matchday: Number(matchday),
      playerIds: selectedIds,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onCreated(result.matchId);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to matches
      </button>

      <h2 className="text-lg font-semibold text-white">Create Match</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block space-y-1.5 sm:col-span-1">
          <span className="text-sm font-medium text-zinc-300">Opponent</span>
          <input
            type="text"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            placeholder="e.g. FCSB"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-300">Date</span>
          <input
            type="date"
            value={matchDate}
            onChange={(e) => setMatchDate(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-300">Matchday / Round</span>
          <input
            type="number"
            min={1}
            step={1}
            value={matchday}
            onChange={(e) => setMatchday(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          />
        </label>
      </div>

      <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-zinc-200">
            Players
            <span className="ml-2 font-normal text-zinc-500">
              ({selectedIds.length} / {players.length} selected)
            </span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={allSelected}
              onClick={() => setSelectedIds(players.map((p) => p.id))}
              className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              Select all
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => setSelectedIds([])}
              className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>
        <ul className="grid max-h-72 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
          {players.map((player) => {
            const checked = selectedIds.includes(player.id);
            return (
              <li key={player.id}>
                <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-800/60">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePlayer(player.id)}
                    className="h-4 w-4 rounded border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-semibold text-zinc-200"
                    aria-hidden
                  >
                    {player.name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <span className="truncate text-sm text-white">{player.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!canSubmit || busy}
        onClick={() => void handleCreate()}
        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        Create Match
      </button>
    </div>
  );
}
