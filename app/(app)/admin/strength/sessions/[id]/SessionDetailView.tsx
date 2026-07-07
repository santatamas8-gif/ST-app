"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  generatePlayerCards,
  publishSessionCards,
  updateCoachAdjustedWeight,
} from "@/app/actions/strength";
import { getFinalDisplayWeight } from "@/lib/strength/calculation";
import { PlayerStrengthCardView } from "@/components/strength/PlayerStrengthCardView";
import type { PlayerCardItem, SessionExerciseWithSets } from "@/lib/strength/types";

type CardRow = {
  id: string;
  player_id: string;
  status: string;
  profiles: { full_name: string | null; email: string | null };
};

type PlayerOption = { id: string; name: string; hasProfile: boolean };

export function SessionDetailView({
  sessionId,
  session,
  exercises,
  cards,
  players,
  previewCard,
}: {
  sessionId: string;
  session: { date: string; title: string; session_type: string; status: string };
  exercises: SessionExerciseWithSets[];
  cards: CardRow[];
  players: PlayerOption[];
  previewCard: {
    playerName: string;
    playerAvatarUrl: string | null;
    items: PlayerCardItem[];
    exerciseImages?: Record<string, string | null>;
  } | null;
}) {
  const router = useRouter();
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "success" | null>(null);
  const [items, setItems] = useState(previewCard?.items ?? []);

  const eligiblePlayerIds = useMemo(
    () => new Set(players.filter((p) => p.hasProfile).map((p) => p.id)),
    [players]
  );

  const eligibleSelected = useMemo(
    () => selectedPlayers.filter((id) => eligiblePlayerIds.has(id)),
    [selectedPlayers, eligiblePlayerIds]
  );

  useEffect(() => {
    setItems(previewCard?.items ?? []);
  }, [previewCard]);

  function togglePlayer(id: string) {
    if (!eligiblePlayerIds.has(id)) return;
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleGenerate() {
    console.log("[SessionDetailView] generate clicked", {
      sessionId,
      selectedPlayers,
      eligibleSelected,
      exercisesCount: exercises.length,
      setsCount: exercises.reduce((n, ex) => n + ex.sets.length, 0),
    });

    if (eligibleSelected.length === 0) {
      setMessage("Select at least one player with a strength profile");
      setMessageType("error");
      return;
    }

    setGenerating(true);
    setMessage(null);
    setMessageType(null);

    try {
      const result = await generatePlayerCards(sessionId, eligibleSelected);
      console.log("[SessionDetailView] generate result", result);

      if (result.error) {
        setMessage(result.error);
        setMessageType("error");
        return;
      }

      setMessage("Cards generated successfully");
      setMessageType("success");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate cards";
      console.error("[SessionDetailView] generate error", err);
      setMessage(msg);
      setMessageType("error");
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setMessage(null);
    setMessageType(null);
    try {
      const result = await publishSessionCards(sessionId);
      if (result.error) {
        setMessage(result.error);
        setMessageType("error");
      } else {
        router.refresh();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to publish cards";
      setMessage(msg);
      setMessageType("error");
    } finally {
      setPublishing(false);
    }
  }

  async function handleWeightAdjust(itemId: string, value: string) {
    const num = value === "" ? null : Number(value);
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    await updateCoachAdjustedWeight(itemId, num);
    const display = getFinalDisplayWeight(item.calculated_weight, num, item.load_type);
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, coach_adjusted_weight: num, display_weight: display }
          : it
      )
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/admin/strength" className="text-sm text-zinc-400 hover:text-white">
            ← Strength Cards
          </Link>
          <h1 className="mt-2 text-xl font-bold text-white sm:text-2xl">{session.title}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {session.date} · {session.session_type}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {cards.length > 0 && (
            <Link
              href={`/admin/strength/sessions/${sessionId}/print`}
              className="min-h-[44px] rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Print
            </Link>
          )}
          {cards.length > 0 && session.status !== "published" && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing}
              className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {publishing ? "Publishing…" : "Publish to players"}
            </button>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-zinc-700/50 bg-zinc-900/40 p-4">
        <h2 className="font-semibold text-white">Session exercises</h2>
        <ul className="mt-3 space-y-2">
          {exercises.map((ex) => (
            <li key={ex.id} className="text-sm text-zinc-300">
              <span className="font-medium text-white">{ex.exercise.name}</span>
              {" — "}
              {ex.sets.map((s) => `${s.reps}@${s.percentage}%`).join(", ")}
            </li>
          ))}
        </ul>
      </section>

      {session.status !== "published" && (
        <section className="rounded-xl border border-zinc-700/50 bg-zinc-900/40 p-4">
          <h2 className="font-semibold text-white">Generate cards</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Select players with strength profiles
            {eligibleSelected.length > 0 && (
              <span className="ml-2 text-emerald-400">
                ({eligibleSelected.length} selected)
              </span>
            )}
          </p>
          <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">
            {players.map((p) => (
              <label
                key={p.id}
                className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 ${
                  !p.hasProfile ? "opacity-50" : "hover:bg-zinc-800/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedPlayers.includes(p.id)}
                  onChange={() => togglePlayer(p.id)}
                  disabled={!p.hasProfile}
                />
                <span className="text-sm text-white">{p.name}</span>
                {!p.hasProfile && (
                  <span className="text-xs text-amber-400">No profile</span>
                )}
              </label>
            ))}
          </div>
          {message && (
            <p
              className={`mt-3 text-sm ${
                messageType === "success" ? "text-emerald-400" : "text-red-400"
              }`}
              role="alert"
            >
              {message}
            </p>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || eligibleSelected.length === 0}
            className="mt-4 min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate cards"}
          </button>
          {eligibleSelected.length === 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              Select at least one player with a strength profile to enable generation.
            </p>
          )}
        </section>
      )}

      {cards.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-semibold text-white">
            Generated cards ({cards.length}) — {session.status}
          </h2>
          <ul className="space-y-1 text-sm text-zinc-400">
            {cards.map((c) => (
              <li key={c.id}>
                {c.profiles?.full_name ?? c.profiles?.email ?? c.player_id} — {c.status}
              </li>
            ))}
          </ul>
          {previewCard && items.length > 0 && (
            <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/40 p-4">
              <p className="mb-4 text-sm text-zinc-400">
                Preview: {previewCard.playerName} (coach can override weights below)
              </p>
              {session.status !== "published" && (
                <div className="mb-4 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-zinc-500">
                        <th className="pb-2">Exercise</th>
                        <th className="pb-2">Set</th>
                        <th className="pb-2">Calc.</th>
                        <th className="pb-2">Coach adj.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id} className="border-t border-zinc-800">
                          <td className="py-1.5 pr-2">{it.exercise_name_snapshot}</td>
                          <td className="py-1.5 pr-2">{it.set_number}</td>
                          <td className="py-1.5 pr-2 tabular-nums">{it.calculated_weight ?? "BW"}</td>
                          <td className="py-1.5">
                            <input
                              type="number"
                              step="0.5"
                              placeholder="—"
                              defaultValue={it.coach_adjusted_weight ?? ""}
                              onBlur={(e) => handleWeightAdjust(it.id, e.target.value)}
                              className="w-20 rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-white"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <PlayerStrengthCardView
                playerName={previewCard.playerName}
                playerAvatarUrl={previewCard.playerAvatarUrl}
                date={session.date}
                title={session.title}
                sessionType={session.session_type}
                items={items}
                exerciseImages={previewCard.exerciseImages}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
