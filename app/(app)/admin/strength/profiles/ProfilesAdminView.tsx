"use client";

import { useState } from "react";
import Link from "next/link";
import { upsertStrengthProfile } from "@/app/actions/strength";
import { PlayerAvatar } from "@/components/strength/PlayerAvatar";
import type { StrengthProfile } from "@/lib/strength/types";

type PlayerRow = {
  id: string;
  name: string;
  avatarUrl: string | null;
  profile: StrengthProfile | null;
};

const FIELDS: { key: keyof StrengthProfile; label: string }[] = [
  { key: "bodyweight", label: "Bodyweight" },
  { key: "squat", label: "Squat" },
  { key: "bench_press", label: "Bench Press" },
  { key: "deadlift", label: "Deadlift" },
  { key: "pull_up", label: "Pull Up" },
  { key: "military_press", label: "Military Press" },
  { key: "clean", label: "Clean" },
  { key: "snatch", label: "Snatch" },
];

export function ProfilesAdminView({ players }: { players: PlayerRow[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  function startEdit(player: PlayerRow) {
    setEditing(player.id);
    const p = player.profile;
    const values: Record<string, string> = { last_test_date: p?.last_test_date ?? "" };
    for (const f of FIELDS) {
      const v = p?.[f.key];
      values[f.key] = v != null ? String(v) : "";
    }
    setForm(values);
  }

  async function save(playerId: string) {
    setSaving(true);
    const data: Record<string, number | string | null> = {
      last_test_date: form.last_test_date || null,
    };
    for (const f of FIELDS) {
      const v = form[f.key];
      data[f.key] = v === "" ? null : Number(v);
    }
    await upsertStrengthProfile(playerId, data as Omit<StrengthProfile, "id" | "player_id" | "updated_at">);
    setSaving(false);
    setEditing(null);
    window.location.reload();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/admin/strength" className="text-sm text-zinc-400 hover:text-white">
          ← Strength Cards
        </Link>
        <h1 className="mt-2 text-xl font-bold text-white sm:text-2xl">Player Strength Profiles</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Reference max values for card generation. Player photos are set on the Dashboard.
        </p>
      </div>

      <div className="space-y-3">
        {players.map((player) => (
          <div
            key={player.id}
            className="rounded-xl border border-zinc-700/50 bg-zinc-900/40 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} variant="screen" className="!h-12 !w-12 !text-sm" />
                <h3 className="font-semibold text-white">{player.name}</h3>
              </div>
              {editing !== player.id ? (
                <button
                  type="button"
                  onClick={() => startEdit(player)}
                  className="min-h-[40px] rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  {player.profile ? "Edit" : "Add profile"}
                </button>
              ) : null}
            </div>

            {editing === player.id ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {FIELDS.map((f) => (
                  <label key={f.key} className="block text-xs text-zinc-400">
                    {f.label}
                    <input
                      type="number"
                      step="0.5"
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 py-2 text-sm text-white"
                    />
                  </label>
                ))}
                <label className="col-span-2 block text-xs text-zinc-400 sm:col-span-4">
                  Last test date
                  <input
                    type="date"
                    value={form.last_test_date ?? ""}
                    onChange={(e) => setForm({ ...form, last_test_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 py-2 text-sm text-white"
                  />
                </label>
                <div className="col-span-2 flex gap-2 sm:col-span-4">
                  <button
                    type="button"
                    onClick={() => save(player.id)}
                    disabled={saving}
                    className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="min-h-[44px] rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : player.profile ? (
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                {FIELDS.map((f) => (
                  <p key={f.key} className="text-zinc-400">
                    <span className="text-zinc-500">{f.label}:</span>{" "}
                    {player.profile![f.key] != null ? `${player.profile![f.key]} kg` : "—"}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-amber-400">No profile — required before generating cards</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
