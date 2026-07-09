"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addCardExercise, removeCardExercise, saveCardExerciseEdits } from "@/app/actions/strength";
import { computeCardItemFields } from "@/lib/strength/cardItemCalc";
import {
  formatSetPercentage,
  groupCardItemsByExercise,
} from "@/lib/strength/cardLayout";
import { isExplosiveExercise } from "@/lib/strength/explosiveExercises";
import { isRepsOnlyPullUpExercise, DEFAULT_PULL_UP_SET_PERCENTAGE } from "@/lib/strength/pullUpExercises";
import type { PlayerCardItem, StrengthExercise, StrengthProfile } from "@/lib/strength/types";
import { ExerciseImage } from "./ExerciseImage";
import { STRENGTH_CARD_EXERCISE_IMAGE_CLASS, StrengthCardHeader } from "./StrengthCardHeader";

type SetDraft = {
  set_number: number;
  reps: number;
  percentage: number;
};

type ExerciseDraft = {
  exerciseId: string;
  exerciseSearch: string;
  sets: SetDraft[];
};

function renumberSets(sets: SetDraft[]): SetDraft[] {
  return sets.map((set, index) => ({ ...set, set_number: index + 1 }));
}

function previewWeight(
  exercise: StrengthExercise | undefined,
  profile: StrengthProfile | null,
  set: SetDraft,
  exerciseOrder: number
): string {
  if (!exercise || !profile) return "—";
  if (isExplosiveExercise(exercise.name)) return "";
  const computed = computeCardItemFields(exercise, profile, set, exerciseOrder);
  return computed.display_weight;
}

interface EditableStrengthCardProps {
  sessionId: string;
  editable: boolean;
  playerName: string;
  playerAvatarUrl?: string | null;
  teamLogoUrl?: string | null;
  date: string;
  title: string;
  sessionType?: string;
  items: PlayerCardItem[];
  exercises: StrengthExercise[];
  previewProfile: StrengthProfile | null;
  exerciseImages?: Record<string, string | null>;
}

export function EditableStrengthCard({
  sessionId,
  editable,
  playerName,
  playerAvatarUrl,
  teamLogoUrl,
  date,
  title,
  sessionType,
  items,
  exercises,
  previewProfile,
  exerciseImages,
}: EditableStrengthCardProps) {
  const router = useRouter();
  const groups = groupCardItemsByExercise(items, 8, exerciseImages);
  const sessionLine = sessionType ? `${title} · ${sessionType}` : title;

  const [editingOrder, setEditingOrder] = useState<number | null>(null);
  const [addingExercise, setAddingExercise] = useState(false);
  const [draft, setDraft] = useState<ExerciseDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredExercises = useMemo(() => {
    const q = (draft?.exerciseSearch ?? "").trim().toLowerCase();
    if (!q) return exercises.slice(0, 30);
    return exercises
      .filter((ex) => {
        const name = ex.name.toLowerCase();
        const category = ex.category.toLowerCase();
        const related = ex.related_to.toLowerCase();
        return name.includes(q) || category.includes(q) || related.includes(q);
      })
      .slice(0, 30);
  }, [draft?.exerciseSearch, exercises]);

  const draftExercise = useMemo(
    () => exercises.find((ex) => ex.id === draft?.exerciseId),
    [draft?.exerciseId, exercises]
  );

  function startEdit(group: (typeof groups)[number]) {
    setEditingOrder(group.exerciseOrder);
    setAddingExercise(false);
    setDraft({
      exerciseId: group.exerciseId ?? "",
      exerciseSearch: group.name,
      sets: group.sets.map((s) => ({
        set_number: s.set_number,
        reps: s.reps,
        percentage: s.percentage,
      })),
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingOrder(null);
    setAddingExercise(false);
    setDraft(null);
    setError(null);
  }

  function startAddExercise() {
    setEditingOrder(null);
    setAddingExercise(true);
    setDraft({
      exerciseId: "",
      exerciseSearch: "",
      sets: [{ set_number: 1, reps: 8, percentage: 70 }],
    });
    setError(null);
  }

  async function confirmEdit(exerciseOrder: number) {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveCardExerciseEdits(sessionId, exerciseOrder, {
        exerciseId: draft.exerciseId,
        sets: draft.sets,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditingOrder(null);
      setDraft(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function confirmAddExercise() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const result = await addCardExercise(sessionId, {
        exerciseId: draft.exerciseId,
        sets: draft.sets,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setAddingExercise(false);
      setDraft(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add exercise");
    } finally {
      setSaving(false);
    }
  }

  function updateSet(index: number, field: "reps" | "percentage", raw: string) {
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    setDraft((prev) => {
      if (!prev) return prev;
      const sets = [...prev.sets];
      sets[index] = { ...sets[index], [field]: num };
      return { ...prev, sets };
    });
  }

  function removeSet(index: number) {
    setDraft((prev) => {
      if (!prev || prev.sets.length <= 1) return prev;
      return { ...prev, sets: renumberSets(prev.sets.filter((_, i) => i !== index)) };
    });
  }

  function addSet() {
    setDraft((prev) => {
      if (!prev || prev.sets.length >= 10) return prev;
      const last = prev.sets[prev.sets.length - 1];
      const ex = exercises.find((e) => e.id === prev.exerciseId);
      const pullUp = isRepsOnlyPullUpExercise(ex?.name);
      const defaultPct = pullUp ? DEFAULT_PULL_UP_SET_PERCENTAGE : 70;
      return {
        ...prev,
        sets: renumberSets([
          ...prev.sets,
          {
            set_number: prev.sets.length + 1,
            reps: last?.reps ?? 6,
            percentage: last?.percentage ?? defaultPct,
          },
        ]),
      };
    });
  }

  function selectDraftExercise(ex: StrengthExercise) {
    setDraft((prev) => {
      if (!prev) return prev;
      const repsOnly = isRepsOnlyPullUpExercise(ex.name);
      return {
        ...prev,
        exerciseId: ex.id,
        exerciseSearch: ex.name,
        sets: prev.sets.map((set) => ({
          ...set,
          percentage: repsOnly ? DEFAULT_PULL_UP_SET_PERCENTAGE : set.percentage || 70,
        })),
      };
    });
  }

  async function handleRemoveExercise(group: (typeof groups)[number]) {
    const ok = window.confirm(`Delete "${group.name}" from this session and all generated cards?`);
    if (!ok) return;

    setSaving(true);
    setError(null);
    try {
      const result = await removeCardExercise(sessionId, group.exerciseOrder);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove exercise");
    } finally {
      setSaving(false);
    }
  }

  function renderExerciseBlock(group: (typeof groups)[number]) {
    const isEditing = editable && editingOrder === group.exerciseOrder;
    const displayName = isEditing ? draftExercise?.name ?? group.name : group.name;
    const explosive = isExplosiveExercise(displayName);
    const repsOnlyPullUp = group.repsOnlyPullUp || isRepsOnlyPullUpExercise(displayName);

    return (
      <article
        key={group.key}
        className="overflow-hidden rounded-lg border border-zinc-700/50 bg-zinc-900/30"
      >
        <div className="flex items-start justify-between gap-2 border-b border-zinc-700/40 px-3 py-2.5 sm:px-4">
          {isEditing ? (
            <div className="min-w-0 flex-1 space-y-2">
              <label className="block text-xs text-zinc-500">Exercise</label>
              <input
                type="text"
                value={draft?.exerciseSearch ?? ""}
                onChange={(e) =>
                  setDraft((prev) =>
                    prev ? { ...prev, exerciseSearch: e.target.value } : prev
                  )
                }
                className="w-full rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-2 text-sm text-white"
                placeholder="Search exercise…"
              />
              <div className="max-h-36 overflow-y-auto rounded-lg border border-zinc-700/60">
                {filteredExercises.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => selectDraftExercise(ex)}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-zinc-800 ${
                      draft?.exerciseId === ex.id ? "bg-emerald-900/40 text-emerald-300" : "text-zinc-300"
                    }`}
                  >
                    {ex.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <h3 className="text-sm font-semibold text-white sm:text-base">{group.name}</h3>
          )}
          {editable && !isEditing && editingOrder == null && !addingExercise && (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => startEdit(group)}
                disabled={saving}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleRemoveExercise(group)}
                disabled={saving}
                className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        <div className="flex items-start gap-3 p-3 sm:gap-4 sm:p-4">
          <ExerciseImage
            src={
              isEditing && draftExercise?.image_url
                ? draftExercise.image_url
                : group.imageUrl
            }
            alt={isEditing ? draftExercise?.name ?? group.name : group.name}
            className={STRENGTH_CARD_EXERCISE_IMAGE_CLASS}
          />
          <div className="min-w-0 flex-1 overflow-x-auto">
            <table className="w-full min-w-[200px] text-sm">
              <thead>
                <tr className="border-b border-zinc-700/50 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="pb-2 pr-3 font-medium">Set</th>
                  {!explosive && !repsOnlyPullUp && <th className="pb-2 pr-3 font-medium">%</th>}
                  {explosive && <th className="pb-2 pr-3 font-medium">%</th>}
                  <th className="pb-2 pr-3 font-medium">Weight</th>
                  <th className="pb-2 pr-3 font-medium">Reps</th>
                  {isEditing && <th className="pb-2 font-medium" />}
                </tr>
              </thead>
              <tbody>
                {(isEditing ? draft?.sets ?? [] : group.sets).map((set, index) => {
                  const displayPct = explosive
                    ? "max exp"
                    : formatSetPercentage(set.percentage);
                  const weight = repsOnlyPullUp
                    ? ""
                    : isEditing
                      ? previewWeight(
                          draftExercise,
                          previewProfile,
                          set,
                          group.exerciseOrder
                        )
                      : explosive
                        ? ""
                        : group.sets[index]?.display_weight ?? "";

                  return (
                    <tr key={`${set.set_number}-${index}`} className="border-b border-zinc-800/60 last:border-0">
                      <td className="py-2 pr-3 tabular-nums text-zinc-500">{set.set_number}</td>
                      {!explosive && !repsOnlyPullUp && (
                        <td className="py-2 pr-3">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.1"
                              min={1}
                              value={set.percentage}
                              onChange={(e) => updateSet(index, "percentage", e.target.value)}
                              className="w-16 rounded border border-zinc-600 bg-zinc-800/80 px-2 py-1 tabular-nums text-white"
                            />
                          ) : (
                            <span className="tabular-nums text-zinc-300">{displayPct}</span>
                          )}
                        </td>
                      )}
                      {explosive && (
                        <td className="py-2 pr-3">
                          <span className="tabular-nums text-zinc-300">{displayPct}</span>
                        </td>
                      )}
                      <td className="py-2 pr-3 font-medium tabular-nums text-white">
                        {weight}
                      </td>
                      <td className="py-2">
                        {isEditing ? (
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={set.reps}
                            onChange={(e) => updateSet(index, "reps", e.target.value)}
                            className="w-14 rounded border border-zinc-600 bg-zinc-800/80 px-2 py-1 tabular-nums text-white"
                          />
                        ) : (
                          <span className="tabular-nums text-zinc-300">{set.reps}</span>
                        )}
                      </td>
                      {isEditing && (
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeSet(index)}
                            disabled={(draft?.sets.length ?? 0) <= 1}
                            className="min-h-[36px] min-w-[36px] rounded border border-zinc-600 px-2 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label={`Remove set ${set.set_number}`}
                            title="Remove set"
                          >
                            ✕
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {isEditing && (
              <button
                type="button"
                onClick={addSet}
                disabled={(draft?.sets.length ?? 0) >= 10}
                className="mt-2 min-h-[40px] rounded-lg border border-dashed border-zinc-600 px-3 py-2 text-xs text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200 disabled:opacity-40"
              >
                + Add set
              </button>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-700/40 px-3 py-3 sm:px-4">
            <button
              type="button"
              onClick={() => confirmEdit(group.exerciseOrder)}
              disabled={saving || !draft?.exerciseId}
              className="min-h-[40px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "OK — save & recalculate"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="min-h-[40px] rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <p className="w-full text-xs text-zinc-500">
              Updates all players&apos; cards for this exercise. Weight is recalculated from the formula.
            </p>
          </div>
        )}
      </article>
    );
  }

  function renderAddExerciseBlock() {
    if (!editable || !addingExercise) return null;

    const displayName = draftExercise?.name ?? "";
    const explosive = isExplosiveExercise(displayName);
    const repsOnlyPullUp = isRepsOnlyPullUpExercise(displayName);

    return (
      <article className="overflow-hidden rounded-lg border border-emerald-700/40 bg-zinc-900/30">
        <div className="border-b border-zinc-700/40 px-3 py-2.5 sm:px-4">
          <div className="min-w-0 flex-1 space-y-2">
            <label className="block text-xs text-zinc-500">New exercise</label>
            <input
              type="text"
              value={draft?.exerciseSearch ?? ""}
              onChange={(e) =>
                setDraft((prev) => (prev ? { ...prev, exerciseSearch: e.target.value } : prev))
              }
              className="w-full rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-2 text-sm text-white"
              placeholder="Search exercise…"
            />
            <div className="max-h-36 overflow-y-auto rounded-lg border border-zinc-700/60">
              {filteredExercises.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => selectDraftExercise(ex)}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-zinc-800 ${
                    draft?.exerciseId === ex.id ? "bg-emerald-900/40 text-emerald-300" : "text-zinc-300"
                  }`}
                >
                  {ex.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 sm:gap-4 sm:p-4">
          <ExerciseImage
            src={draftExercise?.image_url}
            alt={draftExercise?.name ?? "New exercise"}
            className={STRENGTH_CARD_EXERCISE_IMAGE_CLASS}
          />
          <div className="min-w-0 flex-1 overflow-x-auto">
            <table className="w-full min-w-[200px] text-sm">
              <thead>
                <tr className="border-b border-zinc-700/50 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="pb-2 pr-3 font-medium">Set</th>
                  {!explosive && !repsOnlyPullUp && <th className="pb-2 pr-3 font-medium">%</th>}
                  {explosive && <th className="pb-2 pr-3 font-medium">%</th>}
                  <th className="pb-2 pr-3 font-medium">Weight</th>
                  <th className="pb-2 pr-3 font-medium">Reps</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {(draft?.sets ?? []).map((set, index) => {
                  const displayPct = explosive ? "max exp" : formatSetPercentage(set.percentage);
                  return (
                    <tr key={`${set.set_number}-${index}`} className="border-b border-zinc-800/60 last:border-0">
                      <td className="py-2 pr-3 tabular-nums text-zinc-500">{set.set_number}</td>
                      {!explosive && !repsOnlyPullUp && (
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            step="0.1"
                            min={1}
                            value={set.percentage}
                            onChange={(e) => updateSet(index, "percentage", e.target.value)}
                            className="w-16 rounded border border-zinc-600 bg-zinc-800/80 px-2 py-1 tabular-nums text-white"
                          />
                        </td>
                      )}
                      {explosive && (
                        <td className="py-2 pr-3">
                          <span className="tabular-nums text-zinc-300">{displayPct}</span>
                        </td>
                      )}
                      <td className="py-2 pr-3 font-medium tabular-nums text-white">
                        {repsOnlyPullUp
                          ? ""
                          : previewWeight(draftExercise, previewProfile, set, groups.length + 1)}
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={set.reps}
                          onChange={(e) => updateSet(index, "reps", e.target.value)}
                          className="w-14 rounded border border-zinc-600 bg-zinc-800/80 px-2 py-1 tabular-nums text-white"
                        />
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeSet(index)}
                          disabled={(draft?.sets.length ?? 0) <= 1}
                          className="min-h-[36px] min-w-[36px] rounded border border-zinc-600 px-2 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={`Remove set ${set.set_number}`}
                          title="Remove set"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {repsOnlyPullUp && (
              <p className="mt-2 text-xs text-zinc-500">
                This exercise uses fixed set %; only reps can be edited.
              </p>
            )}
            <button
              type="button"
              onClick={addSet}
              disabled={(draft?.sets.length ?? 0) >= 10}
              className="mt-2 min-h-[40px] rounded-lg border border-dashed border-zinc-600 px-3 py-2 text-xs text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200 disabled:opacity-40"
            >
              + Add set
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-700/40 px-3 py-3 sm:px-4">
          <button
            type="button"
            onClick={confirmAddExercise}
            disabled={saving || !draft?.exerciseId}
            className="min-h-[40px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add exercise to all cards"}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={saving}
            className="min-h-[40px] rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </article>
    );
  }

  return (
    <div className="space-y-5">
      <StrengthCardHeader
        playerName={playerName}
        playerAvatarUrl={playerAvatarUrl}
        teamLogoUrl={teamLogoUrl}
        date={date}
        sessionLine={sessionLine}
        hint={
          editable ? (
            <p className="text-xs text-amber-400/90">
              Tap Edit to fix reps, %, sets or swap an exercise. You can also add or delete full exercises before publishing.
            </p>
          ) : null
        }
      />

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      {editable && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={startAddExercise}
            disabled={addingExercise || editingOrder != null || groups.length >= 8 || saving}
            className="min-h-[40px] rounded-lg border border-dashed border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/50 disabled:opacity-40"
          >
            + Add exercise
          </button>
        </div>
      )}

      {renderAddExerciseBlock()}

      <div className="grid grid-cols-1 items-start gap-4 [grid-auto-flow:column] [grid-template-rows:repeat(4,auto)] sm:grid-cols-2 sm:gap-x-5">
        {groups.map(renderExerciseBlock)}
      </div>
    </div>
  );
}
