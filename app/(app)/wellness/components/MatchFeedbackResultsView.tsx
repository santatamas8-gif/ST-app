"use client";

import {
  Activity,
  Brain,
  ClipboardList,
  Clock3,
  HeartPulse,
  Star,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { KioskPlayerAvatar } from "@/app/(app)/kiosk-rpe/components/KioskPlayerAvatar";
import {
  DEMAND_IDLE,
  PERFORMANCE_IDLE,
} from "@/app/(app)/kiosk-rpe/components/matchFeedbackQuestionnaireStyles";
import {
  MENTAL_DEMAND_LABELS,
  PERFORMANCE_RATING_LABELS,
  PHYSICAL_DEMAND_LABELS,
  PRE_MATCH_OTHER_OPTION,
} from "@/lib/matchFeedback/constants";
import { formatMatchFeedbackDate } from "@/lib/matchFeedback/format";
import type { MatchFeedbackListItem, MatchFeedbackMatch, MatchFeedbackResponse } from "@/lib/matchFeedback/types";
import type { KioskPlayer } from "@/lib/players/listPlayers";

type MatchDetailState = {
  match: MatchFeedbackMatch;
  participants: KioskPlayer[];
  responsesByPlayerId: Record<string, MatchFeedbackResponse>;
};

type MatchFeedbackResultsViewProps = {
  matches: MatchFeedbackListItem[];
  /** Preloaded details keyed by match id (from server). */
  detailsByMatchId: Record<string, MatchDetailState>;
};

/** Soft result chips — tinted bg + border, no selection ring. */
function stripHover(classes: string): string {
  return classes
    .split(" ")
    .filter((c) => !c.startsWith("hover:"))
    .join(" ");
}

function AnswerPill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex h-[3.5rem] w-[7.75rem] shrink-0 flex-col items-center justify-center rounded-lg border px-2 text-center ${className}`}
    >
      {children}
    </span>
  );
}

function ScalePill({
  value,
  label,
  colorScale,
}: {
  value: number;
  label: string;
  colorScale: "demand" | "performance";
}) {
  const raw = colorScale === "demand" ? DEMAND_IDLE[value] : PERFORMANCE_IDLE[value];
  const chip = raw ? stripHover(raw) : "border-zinc-200 bg-zinc-50 text-zinc-900";
  return (
    <AnswerPill className={chip}>
      <span className="text-lg font-bold tabular-nums leading-none">{value}</span>
      <span className="mt-1 line-clamp-2 text-[10px] font-medium leading-tight opacity-90">
        {label}
      </span>
    </AnswerPill>
  );
}

function ResultRow({
  icon: Icon,
  question,
  answer,
  iconClassName,
}: {
  icon: LucideIcon;
  question: string;
  answer: ReactNode;
  iconClassName: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 py-3.5 last:border-b-0 last:pb-0 first:pt-0">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <p className="min-w-0 pt-1 text-sm font-semibold leading-snug text-zinc-900">{question}</p>
      </div>
      <div className="shrink-0">{answer}</div>
    </div>
  );
}

export function MatchFeedbackResultsView({
  matches,
  detailsByMatchId,
}: MatchFeedbackResultsViewProps) {
  const [selectedId, setSelectedId] = useState<string>(() => matches[0]?.id ?? "");

  const detail = useMemo(() => {
    if (!selectedId) return null;
    return detailsByMatchId[selectedId] ?? null;
  }, [selectedId, detailsByMatchId]);

  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-12 text-center text-sm text-zinc-500 shadow-sm">
        No Match Feedback matches yet. Create one from the Kiosk Match tab.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block max-w-md space-y-1.5">
        <span className="text-sm font-medium text-zinc-300">Match</span>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="min-h-[44px] w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
        >
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              vs {m.opponent} — {formatMatchFeedbackDate(m.match_date)} (MD {m.matchday})
            </option>
          ))}
        </select>
      </label>

      {detail ? (
        <>
          <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">vs {detail.match.opponent}</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  {formatMatchFeedbackDate(detail.match.match_date)} · Matchday{" "}
                  {detail.match.matchday}
                </p>
                <p className="mt-2 text-xs font-medium text-zinc-500">
                  {Object.keys(detail.responsesByPlayerId).length} / {detail.participants.length}{" "}
                  responses
                </p>
              </div>
            </div>
          </div>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {detail.participants.map((player) => {
              const response = detail.responsesByPlayerId[player.id];
              const submitted = Boolean(response);

              return (
                <li
                  key={player.id}
                  className={`flex flex-col overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-sm ${
                    submitted ? "border-t-[3px] border-t-emerald-500" : "border-t-[3px] border-t-amber-400"
                  }`}
                >
                  <div className="relative flex flex-col items-center px-4 pb-4 pt-5 text-center">
                    <span
                      className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                        submitted
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {submitted ? "Submitted" : "Missing"}
                    </span>
                    <KioskPlayerAvatar
                      name={player.name}
                      avatarUrl={player.avatarUrl}
                      size="card"
                    />
                    <p className="mt-3.5 max-w-full px-8 text-lg font-semibold leading-snug text-zinc-900">
                      {player.name}
                    </p>
                  </div>

                  {response ? (
                    <div className="flex-1 border-t border-zinc-100 px-4 pb-4 pt-1">
                      <ResultRow
                        icon={Activity}
                        iconClassName="bg-zinc-100 text-zinc-600"
                        question="How did you feel before the match?"
                        answer={
                          <AnswerPill className="border-zinc-200 bg-white text-zinc-800">
                            <span className="line-clamp-2 text-[11px] font-semibold leading-snug">
                              {response.pre_match_feelings.join(", ")}
                            </span>
                            {response.pre_match_feelings.includes(PRE_MATCH_OTHER_OPTION) &&
                            response.pre_match_other_text ? (
                              <span className="mt-0.5 line-clamp-2 text-[9px] font-medium leading-snug text-zinc-500">
                                Other: {response.pre_match_other_text}
                              </span>
                            ) : null}
                          </AnswerPill>
                        }
                      />
                      <ResultRow
                        icon={HeartPulse}
                        iconClassName="bg-orange-50 text-orange-600"
                        question="How hard was the match physically?"
                        answer={
                          <ScalePill
                            value={response.physical_demand}
                            label={PHYSICAL_DEMAND_LABELS[response.physical_demand]}
                            colorScale="demand"
                          />
                        }
                      />
                      <ResultRow
                        icon={Brain}
                        iconClassName="bg-amber-50 text-amber-600"
                        question="How hard was the match mentally?"
                        answer={
                          <ScalePill
                            value={response.mental_demand}
                            label={MENTAL_DEMAND_LABELS[response.mental_demand]}
                            colorScale="demand"
                          />
                        }
                      />
                      <ResultRow
                        icon={Clock3}
                        iconClassName="bg-zinc-100 text-zinc-600"
                        question="When did you first feel a physical drop-off?"
                        answer={
                          <AnswerPill className="border-zinc-200 bg-zinc-50 text-zinc-800">
                            <span className="text-sm font-semibold leading-snug">
                              {response.physical_dropoff}
                            </span>
                          </AnswerPill>
                        }
                      />
                      <ResultRow
                        icon={Star}
                        iconClassName="bg-emerald-50 text-emerald-600"
                        question="How would you rate your performance?"
                        answer={
                          <ScalePill
                            value={response.performance_rating}
                            label={PERFORMANCE_RATING_LABELS[response.performance_rating]}
                            colorScale="performance"
                          />
                        }
                      />
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center border-t border-zinc-100 px-6 py-12 text-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                        <ClipboardList className="h-5 w-5" aria-hidden />
                      </span>
                      <p className="mt-3 text-sm font-semibold text-zinc-700">No feedback submitted</p>
                      <p className="mt-1 max-w-[16rem] text-xs leading-snug text-zinc-500">
                        This player hasn&apos;t completed the Match Feedback yet.
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="text-sm text-zinc-500">Select a match to view results.</p>
      )}
    </div>
  );
}
