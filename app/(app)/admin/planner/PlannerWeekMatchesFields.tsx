"use client";

import type { WeekMatchDraft } from "@/lib/gpsPlanner/weekMatchForm";
import { canRemoveConfiguredMatch } from "@/lib/gpsPlanner/weekMatchForm";

const inputClass =
  "w-full min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-white placeholder:text-zinc-600";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-zinc-400">
        {label}
        {required ? <span className="text-zinc-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

type Props = {
  drafts: WeekMatchDraft[];
  onChange: (drafts: WeekMatchDraft[]) => void;
  onRemove: (draft: WeekMatchDraft) => void;
  onAdd: () => void;
};

export function PlannerWeekMatchesFields({
  drafts,
  onChange,
  onRemove,
  onAdd,
}: Props) {
  function patch(index: number, updates: Partial<WeekMatchDraft>) {
    onChange(
      drafts.map((draft, i) => (i === index ? { ...draft, ...updates } : draft))
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-white">Matches</p>
      <p className="text-[11px] text-zinc-500">
        Optional. Exact Match dates and MD tags are typed by Admin. Match dates
        do not have to fall inside the Training date range.
      </p>
      {drafts.length === 0 ? (
        <p className="text-sm text-zinc-500">0 Matches</p>
      ) : null}
      {drafts.map((draft, index) => {
        const canRemove = canRemoveConfiguredMatch(drafts, draft.matchOrder);
        return (
          <div
            key={draft.id ?? `new-${draft.matchOrder}`}
            className="space-y-3 rounded-lg border border-zinc-700/60 bg-zinc-950/60 p-3"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Match {draft.matchOrder}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date" required>
                <input
                  type="date"
                  value={draft.gpsDate}
                  onChange={(e) => patch(index, { gpsDate: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="MD tag" required>
                <input
                  value={draft.mdTag}
                  onChange={(e) => patch(index, { mdTag: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Opponent">
                <input
                  value={draft.opponent}
                  onChange={(e) => patch(index, { opponent: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Matchday">
                <input
                  value={draft.matchday}
                  onChange={(e) => patch(index, { matchday: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Competition">
                <input
                  value={draft.competition}
                  onChange={(e) =>
                    patch(index, { competition: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
            </div>
            {canRemove ? (
              <button
                type="button"
                onClick={() => onRemove(draft)}
                className="min-h-[44px] rounded-lg border border-zinc-700 px-3 text-xs text-zinc-300 hover:bg-zinc-900"
              >
                Remove Match {draft.matchOrder}
              </button>
            ) : (
              <p className="text-xs text-zinc-500">Remove Match 2 first.</p>
            )}
          </div>
        );
      })}
      {drafts.length < 2 ? (
        <button
          type="button"
          onClick={onAdd}
          className="min-h-[44px] rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          {drafts.length === 0 ? "+ Add Match" : "+ Add second match"}
        </button>
      ) : null}
    </div>
  );
}
