"use client";

import { useCallback, useState } from "react";
import type { PlannerUiPlayer, PlannerWeekRow } from "@/lib/gpsPlanner/types";
import { defaultThroughDate } from "@/lib/gpsPlanner/uiDisplay";
import { WeeklyPlannerView } from "./WeeklyPlannerView";
import { PlannerReviewView, type ReviewTab } from "./PlannerReviewView";

type TopMode = "planning" | "review";

type Props = {
  initialWeeks: PlannerWeekRow[];
  players: PlannerUiPlayer[];
};

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * GPS Load Planner shell: Planning | Review (only one visible).
 * Owns Review navigation state so Planning ↔ Review does not reset Weekly/Daily,
 * week, through-date, or day selection. Planning stays mounted/hidden unchanged.
 */
export function GpsLoadPlannerView({ initialWeeks, players }: Props) {
  const [mode, setMode] = useState<TopMode>("planning");
  const [planningWeekId, setPlanningWeekId] = useState(
    initialWeeks[0]?.id ?? ""
  );

  /** After first Review visit, Planning week no longer overwrites Review week. */
  const [reviewOpenedOnce, setReviewOpenedOnce] = useState(false);
  /** Keep Review mounted after first open so loaded rows survive tab switches. */
  const [reviewMounted, setReviewMounted] = useState(false);

  const [reviewTab, setReviewTab] = useState<ReviewTab>("weekly");
  const [reviewWeekId, setReviewWeekId] = useState(
    initialWeeks[0]?.id ?? ""
  );
  const [reviewThroughDate, setReviewThroughDate] = useState(() => {
    const w = initialWeeks[0];
    if (!w) return "";
    return defaultThroughDate(w.startDate, w.endDate, todayIsoLocal());
  });
  const [reviewDayId, setReviewDayId] = useState("");

  const onPlanningWeekIdChange = useCallback((id: string) => {
    setPlanningWeekId(id);
  }, []);

  const openReview = useCallback(() => {
    if (!reviewOpenedOnce) {
      const seedWeekId = planningWeekId || initialWeeks[0]?.id || "";
      const week =
        initialWeeks.find((w) => w.id === seedWeekId) ?? initialWeeks[0];
      if (week) {
        setReviewWeekId(week.id);
        setReviewThroughDate(
          defaultThroughDate(week.startDate, week.endDate, todayIsoLocal())
        );
      }
      setReviewOpenedOnce(true);
      setReviewMounted(true);
    }
    setMode("review");
  }, [reviewOpenedOnce, planningWeekId, initialWeeks]);

  const onReviewWeekIdChange = useCallback((nextWeekId: string) => {
    setReviewWeekId(nextWeekId);
  }, []);

  return (
    <div className="space-y-5">
      <div
        className="inline-flex rounded-lg border border-zinc-700 bg-zinc-950 p-1"
        role="tablist"
        aria-label="Planner mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "planning"}
          onClick={() => setMode("planning")}
          className={`min-h-[40px] rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            mode === "planning"
              ? "bg-red-700 text-white"
              : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
          }`}
        >
          Planning
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "review"}
          onClick={openReview}
          className={`min-h-[40px] rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            mode === "review"
              ? "bg-red-700 text-white"
              : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
          }`}
        >
          Review
        </button>
      </div>

      {/* Keep Planning mounted so week/player state survives Review switches. */}
      <div
        className={mode === "planning" ? "block" : "hidden"}
        aria-hidden={mode !== "planning"}
      >
        <WeeklyPlannerView
          initialWeeks={initialWeeks}
          players={players}
          onWeekIdChange={onPlanningWeekIdChange}
        />
      </div>

      {reviewMounted ? (
        <div
          className={mode === "review" ? "block" : "hidden"}
          aria-hidden={mode !== "review"}
        >
          <PlannerReviewView
            initialWeeks={initialWeeks}
            tab={reviewTab}
            onTabChange={setReviewTab}
            weekId={reviewWeekId}
            onWeekIdChange={onReviewWeekIdChange}
            throughDate={reviewThroughDate}
            onThroughDateChange={setReviewThroughDate}
            dayId={reviewDayId}
            onDayIdChange={setReviewDayId}
          />
        </div>
      ) : null}
    </div>
  );
}
