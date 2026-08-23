"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Plus, Trophy, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addMatchFeedbackParticipants } from "@/lib/matchFeedback/apiClient";
import { matchFeedbackParticipantCounts } from "@/lib/matchFeedback/counters";
import { formatMatchFeedbackDate } from "@/lib/matchFeedback/format";
import type { MatchFeedbackListItem } from "@/lib/matchFeedback/types";
import type { MatchFeedbackMatch, MatchFeedbackResponse } from "@/lib/matchFeedback/types";
import type { KioskPlayer } from "@/lib/players/listPlayers";
import type { SafeError } from "@/lib/supabase/safeQuery";
import { KioskSummaryBar } from "./KioskSummaryBar";
import { KioskMatchCreateForm } from "./KioskMatchCreateForm";
import { KioskMatchPlayerCard } from "./KioskMatchPlayerCard";
import { KioskMatchQuestionnaire } from "./KioskMatchQuestionnaire";

type Step = "list" | "create" | "match" | "form";

type KioskMatchViewProps = {
  players: KioskPlayer[];
  loadError: SafeError | null;
  initialMatches: MatchFeedbackListItem[];
  canCreate: boolean;
};

/** Client-side detail load using browser supabase (RLS: admin/staff select). */
async function fetchMatchDetail(matchId: string) {
  const supabase = createClient();
  const { data: match, error: matchError } = await supabase
    .from("match_feedback_matches")
    .select("id, opponent, match_date, matchday, created_by, created_at")
    .eq("id", matchId)
    .maybeSingle();
  if (matchError || !match) {
    return { error: matchError?.message ?? "Match not found." };
  }

  const { data: partRows, error: partError } = await supabase
    .from("match_feedback_participants")
    .select("player_id")
    .eq("match_id", matchId);
  if (partError) return { error: partError.message };

  const playerIds = (partRows ?? []).map((p: { player_id: string }) => p.player_id);

  const { data: profiles, error: profileError } = playerIds.length
    ? await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", playerIds)
    : { data: [], error: null };
  if (profileError) return { error: profileError.message };

  const name = (full_name: string | null, email: string | null) => {
    const n = (full_name ?? "").trim();
    if (n) return n;
    const e = (email ?? "").trim();
    return e || "Unknown player";
  };

  const byId = new Map(
    (profiles ?? []).map((p: { id: string; full_name: string | null; email: string | null; avatar_url: string | null }) => {
      const trimmed = typeof p.avatar_url === "string" ? p.avatar_url.trim() : "";
      return [
        p.id,
        {
          id: p.id,
          name: name(p.full_name, p.email),
          avatarUrl: trimmed.length > 0 ? trimmed : null,
        } satisfies KioskPlayer,
      ];
    })
  );

  const participants = playerIds
    .map((id) => byId.get(id))
    .filter((p): p is KioskPlayer => Boolean(p))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const { data: responseRows, error: responseError } = await supabase
    .from("match_feedback_responses")
    .select("*")
    .eq("match_id", matchId);
  if (responseError) return { error: responseError.message };

  const responsesByPlayerId: Record<string, MatchFeedbackResponse> = {};
  for (const row of responseRows ?? []) {
    const r = row as MatchFeedbackResponse;
    responsesByPlayerId[r.player_id] = r;
  }

  return {
    data: {
      match: match as MatchFeedbackMatch,
      participants,
      responsesByPlayerId,
    },
  };
}

export function KioskMatchView({
  players,
  loadError,
  initialMatches,
  canCreate,
}: KioskMatchViewProps) {
  const [step, setStep] = useState<Step>("list");
  const [matches, setMatches] = useState(initialMatches);
  const [activeMatch, setActiveMatch] = useState<MatchFeedbackMatch | null>(null);
  const [participants, setParticipants] = useState<KioskPlayer[]>([]);
  const [responsesByPlayerId, setResponsesByPlayerId] = useState<
    Record<string, MatchFeedbackResponse>
  >({});
  const [selectedPlayer, setSelectedPlayer] = useState<KioskPlayer | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showAddPlayers, setShowAddPlayers] = useState(false);
  const [addSelectedIds, setAddSelectedIds] = useState<string[]>([]);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const counts = useMemo(
    () =>
      matchFeedbackParticipantCounts(
        participants.map((p) => p.id),
        Object.keys(responsesByPlayerId)
      ),
    [participants, responsesByPlayerId]
  );

  const availableToAdd = useMemo(() => {
    const onMatch = new Set(participants.map((p) => p.id));
    return players.filter((p) => !onMatch.has(p.id));
  }, [players, participants]);

  const resetAddPlayersUi = useCallback(() => {
    setShowAddPlayers(false);
    setAddSelectedIds([]);
    setAddBusy(false);
    setAddError(null);
  }, []);

  const openMatch = useCallback(async (matchId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    const result = await fetchMatchDetail(matchId);
    setDetailLoading(false);
    if ("error" in result && result.error) {
      setDetailError(result.error);
      return;
    }
    if (!("data" in result) || !result.data) {
      setDetailError("Match not found.");
      return;
    }
    setActiveMatch(result.data.match);
    setParticipants(result.data.participants);
    setResponsesByPlayerId(result.data.responsesByPlayerId);
    setSelectedPlayer(null);
    resetAddPlayersUi();
    setStep("match");
  }, [resetAddPlayersUi]);

  const handleCreated = useCallback(
    async (matchId: string) => {
      // Refresh list entry locally then open
      const result = await fetchMatchDetail(matchId);
      if ("data" in result && result.data) {
        const m = result.data.match;
        setMatches((prev) => [
          {
            ...m,
            participant_count: result.data!.participants.length,
            response_count: Object.keys(result.data!.responsesByPlayerId).length,
          },
          ...prev.filter((x) => x.id !== m.id),
        ]);
        setActiveMatch(m);
        setParticipants(result.data.participants);
        setResponsesByPlayerId(result.data.responsesByPlayerId);
        resetAddPlayersUi();
        setStep("match");
      } else {
        setStep("list");
      }
    },
    [resetAddPlayersUi]
  );

  const toggleAddPlayer = useCallback((id: string) => {
    setAddSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleAddPlayers = useCallback(async () => {
    if (!activeMatch || addSelectedIds.length === 0 || addBusy) return;
    setAddBusy(true);
    setAddError(null);
    const result = await addMatchFeedbackParticipants(activeMatch.id, addSelectedIds);
    setAddBusy(false);
    if (!result.ok) {
      setAddError(result.message);
      return;
    }
    const addedSet = new Set(result.addedPlayerIds);
    const newlyAdded = players
      .filter((p) => addedSet.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    setParticipants((prev) => {
      const merged = [...prev, ...newlyAdded.filter((p) => !prev.some((x) => x.id === p.id))];
      return merged.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    });
    setMatches((prev) =>
      prev.map((m) =>
        m.id === activeMatch.id
          ? { ...m, participant_count: m.participant_count + result.addedPlayerIds.length }
          : m
      )
    );
    resetAddPlayersUi();
  }, [activeMatch, addSelectedIds, addBusy, players, resetAddPlayersUi]);

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4" role="alert">
        <p className="font-medium text-red-400">Unable to load players for Match Feedback.</p>
      </div>
    );
  }

  if (step === "create" && canCreate) {
    return (
      <KioskMatchCreateForm
        players={players}
        onCancel={() => setStep("list")}
        onCreated={(id) => void handleCreated(id)}
      />
    );
  }

  if (step === "form" && activeMatch && selectedPlayer) {
    return (
      <KioskMatchQuestionnaire
        match={activeMatch}
        player={selectedPlayer}
        existing={responsesByPlayerId[selectedPlayer.id] ?? null}
        onCancel={() => {
          setSelectedPlayer(null);
          setStep("match");
        }}
        onSaved={(response) => {
          setResponsesByPlayerId((prev) => ({ ...prev, [response.player_id]: response }));
          setSelectedPlayer(null);
          setStep("match");
          setMatches((prev) =>
            prev.map((m) =>
              m.id === activeMatch.id
                ? {
                    ...m,
                    response_count: Object.keys({
                      ...responsesByPlayerId,
                      [response.player_id]: response,
                    }).length,
                  }
                : m
            )
          );
        }}
      />
    );
  }

  if (step === "match" && activeMatch) {
    const canAdd = canCreate && availableToAdd.length > 0;
    const allAddSelected =
      addSelectedIds.length === availableToAdd.length && availableToAdd.length > 0;

    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => {
            setActiveMatch(null);
            setParticipants([]);
            setResponsesByPlayerId({});
            resetAddPlayersUi();
            setStep("list");
          }}
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to matches
        </button>

        <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold text-white">vs {activeMatch.opponent}</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {formatMatchFeedbackDate(activeMatch.match_date)}
                  <span className="mx-2 text-zinc-600">·</span>
                  Matchday {activeMatch.matchday}
                </p>
              </div>
            </div>
            {canAdd ? (
              <button
                type="button"
                onClick={() => {
                  setShowAddPlayers((v) => !v);
                  setAddError(null);
                  if (showAddPlayers) setAddSelectedIds([]);
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-200 hover:border-emerald-700/60 hover:bg-zinc-900"
              >
                <UserPlus className="h-4 w-4 text-emerald-400" aria-hidden />
                {showAddPlayers ? "Hide add players" : "Add players"}
              </button>
            ) : null}
          </div>
        </div>

        <KioskSummaryBar total={counts.total} completed={counts.completed} missing={counts.missing} />

        {showAddPlayers && canAdd ? (
          <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-zinc-200">
                Add players
                <span className="ml-2 font-normal text-zinc-500">
                  ({addSelectedIds.length} / {availableToAdd.length} selected)
                </span>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={allAddSelected}
                  onClick={() => setAddSelectedIds(availableToAdd.map((p) => p.id))}
                  className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                >
                  Select all
                </button>
                <button
                  type="button"
                  disabled={addSelectedIds.length === 0}
                  onClick={() => setAddSelectedIds([])}
                  className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            </div>
            <ul className="grid max-h-72 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {availableToAdd.map((player) => {
                const checked = addSelectedIds.includes(player.id);
                return (
                  <li key={player.id}>
                    <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-800/60">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAddPlayer(player.id)}
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
            {addError ? (
              <p
                className="mt-3 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300"
                role="alert"
              >
                {addError}
              </p>
            ) : null}
            <button
              type="button"
              disabled={addSelectedIds.length === 0 || addBusy}
              onClick={() => void handleAddPlayers()}
              className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
            >
              {addBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Add to match
            </button>
          </div>
        ) : null}

        {participants.length === 0 ? (
          <p className="text-sm text-zinc-500">No players selected for this match.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {participants.map((player) => (
              <KioskMatchPlayerCard
                key={player.id}
                player={player}
                completed={Boolean(responsesByPlayerId[player.id])}
                onSelect={() => {
                  setSelectedPlayer(player);
                  setStep("form");
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Users className="h-4 w-4" aria-hidden />
          Match Feedback questionnaires
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setStep("create")}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create Match
          </button>
        ) : null}
      </div>

      {detailError ? (
        <p className="text-sm text-red-400" role="alert">
          {detailError}
        </p>
      ) : null}

      {detailLoading ? <p className="text-sm text-zinc-500">Loading match…</p> : null}

      {matches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 px-4 py-10 text-center text-sm text-zinc-500">
          No matches yet.
          {canCreate ? " Create a match to start collecting feedback." : ""}
        </div>
      ) : (
        <ul className="space-y-2">
          {matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => void openMatch(m.id)}
                className="flex min-h-[56px] w-full flex-col items-start gap-0.5 rounded-xl border border-zinc-800/90 bg-zinc-900/50 px-4 py-3 text-left transition hover:border-emerald-700/50 hover:bg-zinc-900/80 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-semibold text-white">vs {m.opponent}</span>
                <span className="text-sm text-zinc-400">
                  {formatMatchFeedbackDate(m.match_date)} · MD {m.matchday} ·{" "}
                  {m.response_count}/{m.participant_count} completed
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
