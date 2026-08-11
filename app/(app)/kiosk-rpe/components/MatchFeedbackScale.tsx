"use client";

import {
  DEMAND_BADGE_IDLE,
  DEMAND_BADGE_SELECTED,
  DEMAND_IDLE,
  DEMAND_SELECTED,
  MF_QUESTION_TITLE,
  PERFORMANCE_BADGE_IDLE,
  PERFORMANCE_BADGE_SELECTED,
  PERFORMANCE_IDLE,
  PERFORMANCE_SELECTED,
} from "./matchFeedbackQuestionnaireStyles";

type MatchFeedbackScaleProps = {
  label: string;
  value: number | null;
  onChange: (n: number) => void;
  valueLabels: Record<number, string>;
  /** demand = low green → high red; performance = low red → high green */
  colorScale: "demand" | "performance";
};

const SCALE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Match-only 1–10 picker: every value and meaning visible (not shared ScaleInput). */
export function MatchFeedbackScale({
  label,
  value,
  onChange,
  valueLabels,
  colorScale,
}: MatchFeedbackScaleProps) {
  const idleMap = colorScale === "demand" ? DEMAND_IDLE : PERFORMANCE_IDLE;
  const selectedMap = colorScale === "demand" ? DEMAND_SELECTED : PERFORMANCE_SELECTED;
  const badgeIdle = colorScale === "demand" ? DEMAND_BADGE_IDLE : PERFORMANCE_BADGE_IDLE;
  const badgeSelected =
    colorScale === "demand" ? DEMAND_BADGE_SELECTED : PERFORMANCE_BADGE_SELECTED;

  return (
    <div className="space-y-3">
      <h2 className={MF_QUESTION_TITLE}>{label}</h2>
      <div className="grid grid-cols-1 gap-2" role="listbox" aria-label={label}>
        {SCALE_VALUES.map((n) => {
          const selected = value === n;
          const meaning = valueLabels[n] ?? "";
          return (
            <button
              key={n}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onChange(n)}
              className={`flex min-h-[48px] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 ${
                selected ? selectedMap[n] : idleMap[n]
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold tabular-nums ${
                  selected ? badgeSelected[n] : badgeIdle[n]
                }`}
              >
                {n}
              </span>
              <span className="min-w-0 text-sm font-medium leading-snug">{meaning}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
