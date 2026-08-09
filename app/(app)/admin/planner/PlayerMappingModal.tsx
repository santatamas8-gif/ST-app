"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  createPlayerMappingAction,
  listPlayerMappingsAction,
  listPowerBiPlayerCandidatesAction,
  updatePlayerMappingAction,
} from "@/app/actions/gpsPlanner";
import { plannerErrorMessage } from "@/lib/gpsPlanner/uiDisplay";
import type {
  PlayerExternalMappingRow,
  PlannerUiPlayer,
} from "@/lib/gpsPlanner/types";
import type { PowerBiPlayerCandidate } from "@/lib/powerbi/queries/playerNames";

type Props = {
  open: boolean;
  onClose: () => void;
  players: PlannerUiPlayer[];
};

const UNMAPPED = "";

export function PlayerMappingModal({ open, onClose, players }: Props) {
  const [mappings, setMappings] = useState<PlayerExternalMappingRow[]>([]);
  const [candidates, setCandidates] = useState<PowerBiPlayerCandidate[]>([]);
  const [draftByPlayerId, setDraftByPlayerId] = useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);

  const mappingByPlayerId = useMemo(() => {
    const m = new Map<string, PlayerExternalMappingRow>();
    for (const row of mappings) m.set(row.playerId, row);
    return m;
  }, [mappings]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, cRes] = await Promise.all([
        listPlayerMappingsAction(),
        listPowerBiPlayerCandidatesAction(),
      ]);
      if (!mRes.ok) {
        setError(plannerErrorMessage(mRes.error.code, mRes.error.message));
        return;
      }
      if (!cRes.ok) {
        setError(plannerErrorMessage(cRes.error.code, cRes.error.message));
        return;
      }
      setMappings(mRes.data);
      setCandidates(cRes.data);
      const drafts: Record<string, string> = {};
      for (const p of players) {
        const existing = mRes.data.find((row) => row.playerId === p.id);
        drafts[p.id] = existing?.externalPlayerName ?? UNMAPPED;
      }
      setDraftByPlayerId(drafts);
    } finally {
      setLoading(false);
    }
  }, [players]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  function saveMapping(playerId: string) {
    const selected = draftByPlayerId[playerId] ?? UNMAPPED;
    if (selected === UNMAPPED) {
      setError("Select a Power BI player before saving.");
      return;
    }
    const existing = mappingByPlayerId.get(playerId);
    if (existing && existing.externalPlayerName === selected) {
      setFlash("Mapping unchanged.");
      return;
    }

    setSavingPlayerId(playerId);
    setError(null);
    setFlash(null);
    startTransition(async () => {
      try {
        const result = existing
          ? await updatePlayerMappingAction({
              playerId,
              externalPlayerName: selected,
            })
          : await createPlayerMappingAction({
              playerId,
              externalPlayerName: selected,
            });
        if (!result.ok) {
          setError(
            plannerErrorMessage(result.error.code, result.error.message)
          );
          return;
        }
        // Domain stores exact candidate.playerName — reflect that in UI.
        setDraftByPlayerId((prev) => ({
          ...prev,
          [playerId]: result.data.externalPlayerName,
        }));
        setFlash(
          existing
            ? `Updated mapping for ${result.data.playerDisplayName}.`
            : `Mapped ${result.data.playerDisplayName}.`
        );
        await load();
      } finally {
        setSavingPlayerId(null);
      }
    });
  }

  if (!open) return null;

  const sortedPlayers = [...players].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-mapping-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-5">
          <div>
            <h3
              id="player-mapping-title"
              className="text-lg font-semibold text-white"
            >
              Player Mapping
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              Map each ST-AMS player to the exact Power BI player name. No
              automatic matching.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-lg border border-zinc-600 px-3 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Close
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
          {(error || flash) && (
            <p
              className={`rounded-lg border px-3 py-2 text-sm ${
                error
                  ? "border-red-700/50 bg-red-950/30 text-red-200"
                  : "border-emerald-700/50 bg-emerald-950/30 text-emerald-200"
              }`}
            >
              {error ?? flash}
            </p>
          )}

          {loading ? (
            <p className="text-sm text-zinc-400">Loading mappings…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="py-2 pr-3 font-medium">ST-AMS Player</th>
                    <th className="py-2 pr-3 font-medium">Power BI Player</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((player) => {
                    const existing = mappingByPlayerId.get(player.id);
                    const draft = draftByPlayerId[player.id] ?? UNMAPPED;
                    const mapped = Boolean(existing);
                    const dirty =
                      (existing?.externalPlayerName ?? UNMAPPED) !== draft;
                    return (
                      <tr
                        key={player.id}
                        className="border-b border-zinc-800/60"
                      >
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2.5">
                            {player.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={player.avatarUrl}
                                alt=""
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-400">
                                {player.name.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                            <span className="font-medium text-zinc-100">
                              {player.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          <select
                            value={draft}
                            onChange={(e) =>
                              setDraftByPlayerId((prev) => ({
                                ...prev,
                                [player.id]: e.target.value,
                              }))
                            }
                            className="w-full min-h-[40px] max-w-[280px] rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-sm text-white"
                          >
                            <option value={UNMAPPED}>— Select —</option>
                            {candidates.map((c) => (
                              <option key={c.playerName} value={c.playerName}>
                                {c.playerName}
                              </option>
                            ))}
                            {existing &&
                              !candidates.some(
                                (c) =>
                                  c.playerName === existing.externalPlayerName
                              ) && (
                                <option value={existing.externalPlayerName}>
                                  {existing.externalPlayerName}
                                </option>
                              )}
                          </select>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-xs ${
                              mapped
                                ? "border-emerald-800/50 text-emerald-300"
                                : "border-zinc-700 text-zinc-400"
                            }`}
                          >
                            {mapped ? "Mapped" : "Not mapped"}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <button
                            type="button"
                            disabled={
                              pending ||
                              savingPlayerId === player.id ||
                              draft === UNMAPPED ||
                              !dirty
                            }
                            onClick={() => saveMapping(player.id)}
                            className="min-h-[40px] rounded-lg border border-emerald-700/50 px-3 text-xs text-emerald-200 hover:bg-emerald-950/30 disabled:opacity-40"
                          >
                            {savingPlayerId === player.id
                              ? "Saving…"
                              : mapped
                                ? "Update"
                                : "Save"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
