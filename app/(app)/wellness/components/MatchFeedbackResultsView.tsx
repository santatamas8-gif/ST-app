"use client";

import {
  Activity,
  Brain,
  ChevronDown,
  ClipboardList,
  Clock3,
  HeartPulse,
  Loader2,
  Star,
  Trash2,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { KioskPlayerAvatar } from "@/app/(app)/kiosk-rpe/components/KioskPlayerAvatar";
import {
  DEMAND_IDLE,
  PERFORMANCE_IDLE,
} from "@/app/(app)/kiosk-rpe/components/matchFeedbackQuestionnaireStyles";
import { deleteMatchFeedbackMatch } from "@/lib/matchFeedback/apiClient";import {
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
  /** Admin only — show delete control in match picker. */
  canDeleteMatch?: boolean;
};

function formatMatchOptionLabel(match: MatchFeedbackListItem): string {
  return `vs ${match.opponent} — ${formatMatchFeedbackDate(match.match_date)} (MD ${match.matchday})`;
}

function MatchSelector({
  matches,
  selectedId,
  onSelect,
  canDelete,
  deletingId,
  onDelete,
}: {
  matches: MatchFeedbackListItem[];
  selectedId: string;
  onSelect: (matchId: string) => void;
  canDelete: boolean;
  deletingId: string | null;
  onDelete: (match: MatchFeedbackListItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = matches.find((m) => m.id === selectedId);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative max-w-md">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-sm text-white outline-none focus:border-emerald-500"
      >
        <span className="min-w-0 truncate">
          {selected ? formatMatchOptionLabel(selected) : "Select a match"}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 py-1 shadow-lg"
        >
          {matches.map((match) => {
            const isSelected = match.id === selectedId;
            const isDeleting = deletingId === match.id;
            return (
              <li key={match.id} role="option" aria-selected={isSelected}>
                <div
                  className={`flex items-center gap-1 px-1 ${
                    isSelected ? "bg-emerald-950/40" : "hover:bg-zinc-900"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(match.id);
                      setOpen(false);
                    }}
                    className="min-h-[40px] min-w-0 flex-1 truncate px-2 py-2 text-left text-sm text-white"
                  >
                    {formatMatchOptionLabel(match)}
                  </button>
                  {canDelete ? (
                    <button
                      type="button"
                      aria-label={`Delete ${formatMatchOptionLabel(match)}`}
                      disabled={Boolean(deletingId)}
                      onClick={() => onDelete(match)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 opacity-40 transition hover:bg-red-950/40 hover:text-red-400 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

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

function FeelingsAnswerPill({
  feelings,
  otherText,
  open,
  onToggle,
}: {
  feelings: string[];
  otherText: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  const expandable = feelings.length > 1 || Boolean(otherText);

  const body = (
    <>
      <span className="line-clamp-2 text-[11px] font-semibold leading-snug">
        {feelings.join(", ")}
      </span>
      {feelings.includes(PRE_MATCH_OTHER_OPTION) && otherText ? (
        <span className="mt-0.5 line-clamp-2 text-[9px] font-medium leading-snug text-zinc-500">
          Other: {otherText}
        </span>
      ) : null}
    </>
  );

  if (!expandable) {
    return <AnswerPill className="border-zinc-200 bg-white text-zinc-800">{body}</AnswerPill>;
  }

  return (
    <div className={`relative ${open ? "z-30" : "z-10"}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={onToggle}
        className={`inline-flex h-[3.5rem] w-[7.75rem] shrink-0 flex-col items-center justify-center rounded-lg border px-2 text-center outline-none transition-colors ${
          open
            ? "border-zinc-300 bg-zinc-50 text-zinc-800 ring-2 ring-zinc-200"
            : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
        } focus-visible:ring-2 focus-visible:ring-emerald-500/40`}
      >
        {body}
      </button>
      {open ? (
        <div
          role="dialog"
          className="absolute right-0 top-[calc(100%+0.4rem)] z-30 w-56 rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-lg"
        >
          <ul className="space-y-1.5">
            {feelings.map((feeling) => (
              <li key={feeling} className="text-sm font-medium leading-snug text-zinc-900">
                {feeling}
                {feeling === PRE_MATCH_OTHER_OPTION && otherText ? (
                  <span className="mt-0.5 block text-xs font-normal text-zinc-500">{otherText}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
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
  canDeleteMatch = false,
}: MatchFeedbackResultsViewProps) {
  const router = useRouter();
  const [matchItems, setMatchItems] = useState(matches);
  const [selectedId, setSelectedId] = useState<string>(() => matches[0]?.id ?? "");
  const [openFeelingsPlayerId, setOpenFeelingsPlayerId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setMatchItems(matches);
  }, [matches]);

  useEffect(() => {
    if (!selectedId && matchItems[0]?.id) {
      setSelectedId(matchItems[0].id);
      return;
    }
    if (selectedId && !matchItems.some((m) => m.id === selectedId)) {
      setSelectedId(matchItems[0]?.id ?? "");
    }
  }, [matchItems, selectedId]);

  const detail = useMemo(() => {
    if (!selectedId) return null;
    return detailsByMatchId[selectedId] ?? null;
  }, [selectedId, detailsByMatchId]);

  useEffect(() => {
    setOpenFeelingsPlayerId(null);
  }, [selectedId]);

  useEffect(() => {
    if (!openFeelingsPlayerId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenFeelingsPlayerId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openFeelingsPlayerId]);

  async function handleDeleteMatch(match: MatchFeedbackListItem) {
    const label = formatMatchOptionLabel(match);
    if (
      !window.confirm(
        `Delete ${label}?\n\nAll participants and responses for this match will be permanently removed.`
      )
    ) {
      return;
    }

    setDeleteError(null);
    setDeletingId(match.id);
    const result = await deleteMatchFeedbackMatch(match.id);
    setDeletingId(null);

    if (!result.ok) {
      setDeleteError(result.message);
      return;
    }

    setMatchItems((current) => {
      const remaining = current.filter((item) => item.id !== match.id);
      if (selectedId === match.id) {
        setSelectedId(remaining[0]?.id ?? "");
      }
      return remaining;
    });
    router.refresh();
  }

  if (matchItems.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-12 text-center text-sm text-zinc-500 shadow-sm">
        No Match Feedback matches yet. Create one from the Kiosk Match tab.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {openFeelingsPlayerId ? (
        <button
          type="button"
          className="fixed inset-0 z-20 cursor-default bg-transparent"
          aria-label="Close feelings details"
          onClick={() => setOpenFeelingsPlayerId(null)}
        />
      ) : null}
      <label className="block max-w-md space-y-1.5">
        <span className="text-sm font-medium text-zinc-300">Match</span>
        <MatchSelector
          matches={matchItems}
          selectedId={selectedId}
          onSelect={(matchId) => {
            setSelectedId(matchId);
            setOpenFeelingsPlayerId(null);
          }}
          canDelete={canDeleteMatch}
          deletingId={deletingId}
          onDelete={handleDeleteMatch}
        />
        {deleteError ? (
          <p className="text-xs text-red-400" role="alert">
            {deleteError}
          </p>
        ) : null}
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
                  className={`flex flex-col overflow-visible rounded-xl border border-zinc-200/90 bg-white shadow-sm ${
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
                          <FeelingsAnswerPill
                            feelings={response.pre_match_feelings}
                            otherText={response.pre_match_other_text}
                            open={openFeelingsPlayerId === player.id}
                            onToggle={() =>
                              setOpenFeelingsPlayerId((current) =>
                                current === player.id ? null : player.id
                              )
                            }
                          />
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
