"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { createDailySession, saveSessionExercises } from "@/app/actions/strength";
import type { StrengthExercise } from "@/lib/strength/types";
import { SESSION_TYPES } from "@/lib/strength/types";

type Scheme = {
  id: string;
  name: string;
  strength_set_rep_scheme_items: {
    set_number: number;
    percentage: number;
    reps: number;
  }[];
};

type ExerciseDraft = {
  exercise_id: string;
  exercise_order: number;
  sets: { set_number: number; reps: number; percentage: number }[];
};

export function CreateSessionView({
  exercises,
  schemes,
}: {
  exercises: StrengthExercise[];
  schemes: Scheme[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("");
  const [sessionType, setSessionType] = useState<string>(SESSION_TYPES[0]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ExerciseDraft>>({});
  const [globalSchemeId, setGlobalSchemeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState("");

  const filteredExercises = useMemo(() => {
    const q = exerciseSearch.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((ex) => {
      const name = ex.name.toLowerCase();
      const category = ex.category.toLowerCase();
      const related = ex.related_to.toLowerCase();
      return name.includes(q) || category.includes(q) || related.includes(q);
    });
  }, [exerciseSearch, exercises]);

  function toggleExercise(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        setDrafts((d) => {
          const copy = { ...d };
          delete copy[id];
          return copy;
        });
        return next;
      }
      if (prev.length >= 8) return prev;
      const order = prev.length + 1;
      const defaultSets = globalSchemeId
        ? applyScheme(globalSchemeId)
        : [{ set_number: 1, reps: 8, percentage: 70 }];
      setDrafts((d) => ({
        ...d,
        [id]: { exercise_id: id, exercise_order: order, sets: defaultSets },
      }));
      return [...prev, id];
    });
  }

  function applyScheme(schemeId: string) {
    const scheme = schemes.find((s) => s.id === schemeId);
    if (!scheme) return [{ set_number: 1, reps: 8, percentage: 70 }];
    return scheme.strength_set_rep_scheme_items
      .sort((a, b) => a.set_number - b.set_number)
      .map((it) => ({
        set_number: it.set_number,
        reps: it.reps,
        percentage: it.percentage,
      }));
  }

  function applySchemeToAll(schemeId: string) {
    setGlobalSchemeId(schemeId);
    if (!schemeId) return;
    const sets = applyScheme(schemeId);
    setDrafts((d) => {
      const copy = { ...d };
      for (const id of Object.keys(copy)) {
        copy[id] = { ...copy[id], sets: [...sets] };
      }
      return copy;
    });
  }

  function applySchemeToExercise(exerciseId: string, schemeId: string) {
    if (!schemeId) return;
    const sets = applyScheme(schemeId);
    setDrafts((d) => ({
      ...d,
      [exerciseId]: { ...d[exerciseId], sets: [...sets] },
    }));
  }

  function updateSet(
    exerciseId: string,
    setIndex: number,
    field: "reps" | "percentage",
    value: number
  ) {
    setDrafts((d) => {
      const ex = d[exerciseId];
      if (!ex) return d;
      const sets = [...ex.sets];
      sets[setIndex] = { ...sets[setIndex], [field]: value };
      return { ...d, [exerciseId]: { ...ex, sets } };
    });
  }

  function addSet(exerciseId: string) {
    setDrafts((d) => {
      const ex = d[exerciseId];
      if (!ex) return d;
      const n = ex.sets.length + 1;
      const last = ex.sets[ex.sets.length - 1];
      return {
        ...d,
        [exerciseId]: {
          ...ex,
          sets: [
            ...ex.sets,
            { set_number: n, reps: last?.reps ?? 8, percentage: last?.percentage ?? 70 },
          ],
        },
      };
    });
  }

  function removeSet(exerciseId: string, setIndex: number) {
    setDrafts((d) => {
      const ex = d[exerciseId];
      if (!ex || ex.sets.length <= 1) return d;
      const sets = ex.sets
        .filter((_, i) => i !== setIndex)
        .map((s, i) => ({ ...s, set_number: i + 1 }));
      return { ...d, [exerciseId]: { ...ex, sets } };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Session title is required");
      return;
    }
    if (selectedIds.length < 1) {
      setError("Select at least one exercise");
      return;
    }

    setSaving(true);
    const created = await createDailySession({ date, title: title.trim(), session_type: sessionType });
    if (created.error || !created.sessionId) {
      setError(created.error ?? "Failed to create session");
      setSaving(false);
      return;
    }

    const exercisePayload = selectedIds.map((id, i) => {
      const d = drafts[id];
      return {
        exercise_id: id,
        exercise_order: i + 1,
        sets: d.sets,
      };
    });

    const saved = await saveSessionExercises(created.sessionId, exercisePayload);
    setSaving(false);
    if (saved.error) {
      setError(saved.error);
      return;
    }
    router.push(`/admin/strength/sessions/${created.sessionId}`);
  }

  const selectedExercises = selectedIds
    .map((id) => exercises.find((e) => e.id === id))
    .filter(Boolean) as StrengthExercise[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/strength" className="text-sm text-zinc-400 hover:text-white">
          ← Strength Cards
        </Link>
        <h1 className="mt-2 text-xl font-bold text-white sm:text-2xl">New Daily Session</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm text-zinc-400">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="mt-1 w-full min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-sm text-zinc-400 sm:col-span-2">
            Session title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lower Body Strength"
              required
              className="mt-1 w-full min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-sm text-zinc-400">
            Session type
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-white"
            >
              {SESSION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-white">
              Exercises ({selectedIds.length}/8)
            </h2>
            <label className="text-sm text-zinc-400">
              Apply scheme to all:
              <select
                value={globalSchemeId}
                onChange={(e) => applySchemeToAll(e.target.value)}
                className="ml-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-white"
              >
                <option value="">—</option>
                {schemes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mb-3 block text-sm text-zinc-400">
            Search exercises
            <input
              type="text"
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              placeholder="Search by name, category, related lift…"
              className="mt-2 w-full min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-white placeholder:text-zinc-500"
            />
          </label>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-zinc-700/50 p-2">
            {filteredExercises.map((ex) => (
              <label
                key={ex.id}
                className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${
                  selectedIds.includes(ex.id) ? "bg-emerald-600/15" : "hover:bg-zinc-800/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(ex.id)}
                  onChange={() => toggleExercise(ex.id)}
                  disabled={!selectedIds.includes(ex.id) && selectedIds.length >= 8}
                  className="h-4 w-4"
                />
                <span className="text-sm text-white">{ex.name}</span>
                <span className="text-xs text-zinc-500">{ex.category}</span>
              </label>
            ))}
            {filteredExercises.length === 0 && (
              <p className="px-3 py-2 text-sm text-zinc-500">No exercises found.</p>
            )}
          </div>
        </div>

        {selectedExercises.map((ex, idx) => (
          <div
            key={ex.id}
            className="rounded-xl border border-zinc-700/50 bg-zinc-900/40 p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium text-white">
                {idx + 1}. {ex.name}
              </h3>
              <label className="text-xs text-zinc-400">
                Scheme:
                <select
                  defaultValue=""
                  onChange={(e) => applySchemeToExercise(ex.id, e.target.value)}
                  className="ml-1 rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-white"
                >
                  <option value="">—</option>
                  {schemes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="space-y-2">
              {(drafts[ex.id]?.sets ?? []).map((set, si) => (
                <div key={si} className="flex flex-wrap items-center gap-2">
                  <span className="w-12 text-xs text-zinc-500">Set {set.set_number}</span>
                  <input
                    type="number"
                    value={set.reps}
                    onChange={(e) => updateSet(ex.id, si, "reps", Number(e.target.value))}
                    className="w-16 rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-sm text-white"
                    min={1}
                  />
                  <span className="text-xs text-zinc-500">reps</span>
                  <input
                    type="number"
                    value={set.percentage}
                    onChange={(e) => updateSet(ex.id, si, "percentage", Number(e.target.value))}
                    className="w-16 rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-sm text-white"
                    min={1}
                    max={100}
                  />
                  <span className="text-xs text-zinc-500">%</span>
                  {(drafts[ex.id]?.sets.length ?? 0) > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSet(ex.id, si)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addSet(ex.id)}
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                + Add set
              </button>
            </div>
          </div>
        ))}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="min-h-[48px] w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 sm:w-auto"
        >
          {saving ? "Creating…" : "Create session"}
        </button>
      </form>
    </div>
  );
}
