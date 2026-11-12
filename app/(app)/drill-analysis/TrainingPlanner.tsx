"use client";

import { useState } from "react";
import { formatDrillMetric, formatDurationMinutes, formatSessionDate } from "@/lib/drillAnalysis/format";
import {
  estimateDrillLoad,
  planMetricLabel,
  PLAN_SUM_METRICS,
  type PlanItemSnapshot,
} from "@/lib/drillAnalysis/trainingPlan";
import { DRILL_METRICS } from "@/lib/drillAnalysis/types";

const CARD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PlannerDraftItem = {
  sourceSessionKey: string;
  sourceEntryId: string;
  snapshot: PlanItemSnapshot;
  hasImage: boolean;
  savedItemId: string | null;
};

export type PlannerDraft = {
  id: string | null;
  name: string;
  planDate: string;
  notes: string;
  items: PlannerDraftItem[];
  clean: boolean;
};

export function TrainingPlanner({
  draft,
  saving,
  error,
  onChange,
  onSave,
  onPrint,
}: {
  draft: PlannerDraft;
  saving: boolean;
  error: string | null;
  onChange: (draft: PlannerDraft) => void;
  onSave: () => void;
  onPrint: () => void;
}) {
  const estimate = estimateDrillLoad(draft.items.map((item) => item.snapshot));
  const partial = PLAN_SUM_METRICS.some((key) => estimate.metrics[key].partial) || estimate.duration.partial;
  const status = draft.clean && draft.id ? "Saved" : draft.id ? "Unsaved changes" : "Not saved";
  const [notesOpen, setNotesOpen] = useState(false);
  const hasNotes = draft.notes.trim().length > 0;

  function update(patch: Partial<PlannerDraft>) {
    onChange({ ...draft, ...patch, clean: false });
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= draft.items.length) return;
    const items = [...draft.items];
    const [item] = items.splice(index, 1);
    items.splice(target, 0, item);
    update({ items });
  }

  function renderTotals(screen: boolean) {
    const labelClass = screen ? "text-sm font-medium text-[#3d4f63]" : "text-sm font-medium text-zinc-600";
    const valueClass = screen ? "text-[22px] font-bold leading-none text-[#11243B]" : "text-[22px] font-bold leading-none text-zinc-900";
    return (
    <>
      {PLAN_SUM_METRICS.map((key) => {
        const metric = DRILL_METRICS.find((item) => item.key === key);
        const total = estimate.metrics[key];
        return (
          <div key={key} className="min-w-0">
            <div className={labelClass}>{planMetricLabel(key)}</div>
            <div className={valueClass}>
              {metric ? formatDrillMetric(total.total, metric.unit) : "—"}
            </div>
          </div>
        );
      })}
      <div className="min-w-0">
        <div className={labelClass}>Time</div>
        <div className={valueClass}>{formatDurationMinutes(estimate.duration.total)}</div>
      </div>
    </>
    );
  }

  return (
    <section className="da-plan-editor space-y-3 rounded-xl border border-[#d5dee6] bg-white p-3 sm:p-4">
      <style>{`
        @media screen {
          .da-plan-editor { border: 0; padding: 0; border-radius: 0; background: transparent; }
          .da-plan-editor.space-y-3 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.375rem; }
        }
      `}</style>
      <div className="da-screen-only flex min-w-0 flex-wrap items-end gap-x-3 gap-y-2">
        <label className="w-full min-w-0 max-w-[26.25rem] flex-[1_1_18.75rem]">
          <span className="mb-1 block text-sm font-medium text-[#3d4f63]">Plan name</span>
          <input
            value={draft.name}
            onChange={(event) => update({ name: event.target.value })}
            maxLength={120}
            className="h-11 w-full rounded-lg border border-[#d5dee6] bg-white px-3 text-base text-[#11243B]"
          />
        </label>
        <label className="w-[11.25rem] shrink-0">
          <span className="mb-1 block text-sm font-medium text-[#3d4f63]">Plan date</span>
          <input
            type="date"
            value={draft.planDate}
            onChange={(event) => update({ planDate: event.target.value })}
            className="h-11 w-full rounded-lg border border-[#d5dee6] bg-white px-3 text-base text-[#11243B]"
          />
        </label>
        <p className="flex h-11 shrink-0 items-center text-sm font-medium text-[#0f766e]">{status}</p>
        <div className="ml-auto flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="h-11 rounded-lg bg-[#11243B] px-4 text-base font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save plan"}
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="h-11 rounded-lg border border-[#d5dee6] bg-white px-4 text-base font-medium text-[#11243B]"
          >
            Print / Save PDF
          </button>
        </div>
        {error ? <p className="basis-full text-sm text-zinc-800">{error}</p> : null}
      </div>
      <div className="da-screen-only min-w-0">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-expanded={notesOpen}
            onClick={() => setNotesOpen((open) => !open)}
            className="shrink-0 text-sm font-medium leading-5 text-[#11243B]"
          >
            {hasNotes ? "Edit notes" : "Add notes"}
          </button>
          {!notesOpen && hasNotes ? <p className="min-w-0 flex-1 truncate text-sm text-[#3d4f63]">{draft.notes.trim()}</p> : null}
        </div>
        {notesOpen ? (
          <label className="mt-1 block">
            <span className="mb-1 block text-sm font-medium text-[#3d4f63]">Notes</span>
            <textarea
              value={draft.notes}
              onChange={(event) => update({ notes: event.target.value })}
              rows={2}
              maxLength={2000}
              className="w-full rounded-lg border border-[#d5dee6] bg-white px-3 py-2 text-base text-[#11243B]"
            />
          </label>
        ) : null}
      </div>
      <div className="da-screen-only border-y border-[#e5e7eb] bg-white py-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h3 className="text-base font-bold text-[#11243B]">Estimated drill load</h3>
          {partial ? <p className="text-sm font-medium text-[#0f766e]">Partial estimate</p> : null}
        </div>
        <p className="text-sm text-[#3d4f63]">Based on selected previous sessions.</p>
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4 lg:grid-cols-7">{renderTotals(true)}</div>
      </div>

      <article className="da-plan-sheet space-y-3">
        <header className="da-print-only border-b border-[#0f766e] pb-2">
          <h2 className="text-2xl font-semibold leading-tight text-[#11243B]">{draft.name.trim() || "Training plan"}</h2>
          <p className="mt-1 text-base font-medium text-[#1e3a4c]">
            Plan date {formatSessionDate(draft.planDate)}
            <span className="da-screen-only"> · {status}</span>
          </p>
          {draft.notes.trim() ? <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{draft.notes}</p> : null}
        </header>
        <div className="da-print-only rounded-md border border-[#d5dee6] bg-white px-3 py-2">
          <h3 className="text-base font-bold text-[#11243B]">Estimated drill load</h3>
          <p className="text-sm text-zinc-600">Based on selected previous sessions.</p>
          {partial ? <p className="text-sm font-medium text-[#0f766e]">Partial estimate</p> : null}
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">{renderTotals(false)}</div>
        </div>
        {draft.items.length === 0 ? <p className="text-sm text-zinc-700">No drills in this plan yet.</p> : null}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {draft.items.map((item, index) => (
            <PlanCard
              key={`${item.sourceSessionKey}:${item.sourceEntryId}`}
              item={item}
              planId={draft.id}
              index={index}
              count={draft.items.length}
              onMove={(delta) => move(index, delta)}
              onRemove={() => update({ items: draft.items.filter((_, itemIndex) => itemIndex !== index) })}
            />
          ))}
        </div>
      </article>
    </section>
  );
}

function PlanCard({
  item,
  planId,
  index,
  count,
  onMove,
  onRemove,
}: {
  item: PlannerDraftItem;
  planId: string | null;
  index: number;
  count: number;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const snapshot = item.snapshot;
  const src = imageSrc(item, planId);
  const several = snapshot.sets.length > 1;
  return (
    <article className="da-plan-card overflow-hidden rounded-md border border-[#d5dee6] bg-white">
      <div className="da-plan-band flex items-start justify-between gap-2 bg-[#e7eef3] px-2.5 py-1.5">
        <h3 className="min-w-0 text-[15px] font-bold leading-snug text-[#11243B]">{snapshot.title}</h3>
        <div className="da-screen-only flex shrink-0 gap-1">
          <button type="button" className="h-7 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-700" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up">Up</button>
          <button type="button" className="h-7 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-700" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Move down">Down</button>
          <button type="button" className="h-7 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-700" onClick={onRemove}>Remove</button>
        </div>
      </div>
      <p className="px-2.5 pt-1 text-sm text-zinc-600">
        Source {formatSessionDate(snapshot.sourceDate)} · {snapshot.sessionLabel}
        {snapshot.displayName && snapshot.displayName !== snapshot.title ? ` · ${snapshot.displayName}` : ""}
      </p>
      {snapshot.note ? <p className="whitespace-pre-wrap px-2.5 pt-1 text-sm text-zinc-700">{snapshot.note}</p> : null}
      <div className="grid grid-cols-1 items-start gap-2 p-2 lg:grid-cols-[38%_minmax(0,1fr)]">
        <div className="flex h-36 items-center justify-center overflow-hidden rounded-md bg-[#f4f6f8] lg:h-[190px]">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-contain object-center" />
          ) : (
            <span className="text-sm text-zinc-500">No image</span>
          )}
        </div>
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[15px]">
            {several ? (
              <thead>
                <tr className="bg-[#f4f7f8] text-sm text-[#11243B]">
                  <th className="border-b border-[#e7e5e4] px-2 py-1.5 text-left font-semibold">Metric</th>
                  {snapshot.sets.map((set, setIndex) => (
                    <th key={set.occurrenceKey} className="border-b border-[#e7e5e4] px-2 py-1.5 text-right font-semibold">
                      {setIndex + 1}. {set.drillName}
                      {set.durationMinutes !== null ? <span className="mt-0.5 block text-xs font-medium text-zinc-500">{formatDurationMinutes(set.durationMinutes)}</span> : null}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {!several && snapshot.sets[0]?.durationMinutes !== null ? (
                <tr className="border-b border-[#e7e5e4]">
                  <th className="px-2 py-1.5 text-left text-sm font-medium text-zinc-600">Duration</th>
                  <td className="px-2 py-1.5 text-right font-bold">{formatDurationMinutes(snapshot.sets[0].durationMinutes)}</td>
                </tr>
              ) : null}
              {DRILL_METRICS.map((metric, metricIndex) => (
                <tr key={metric.key} className={metricIndex % 2 === 1 ? "bg-[#f7f7f8]" : ""}>
                  <th className="border-b border-[#e7e5e4] px-2 py-1.5 text-left text-sm font-medium text-zinc-600">{metric.label}</th>
                  {snapshot.sets.map((set) => (
                    <td key={set.occurrenceKey} className="border-b border-[#e7e5e4] px-2 py-1.5 text-right font-bold">
                      {formatDrillMetric(set.metrics[metric.key], metric.unit)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  );
}

function imageSrc(item: PlannerDraftItem, planId: string | null): string | null {
  if (!item.hasImage) return null;
  if (planId && item.savedItemId) {
    return `/api/drill-analysis/plans/image?planId=${encodeURIComponent(planId)}&itemId=${encodeURIComponent(item.savedItemId)}`;
  }
  if (CARD_ID.test(item.sourceEntryId)) {
    return `/api/drill-analysis/image?cardId=${encodeURIComponent(item.sourceEntryId)}`;
  }
  return null;
}
