"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Card } from "@/components/Card";
import {
  OVERLOAD_FOCUS_VALUES,
  WEEK_STATUSES,
  WEEK_TYPES,
  type OverloadFocusMetric,
  type PlannerWeekStatus,
  type PlannerWeekType,
} from "@/lib/gpsPlanner/common";
import {
  calculatePlannedAbsolutes,
  remainingToAllocate,
  sumPercentageMetrics,
  type PercentageMetrics,
} from "@/lib/gpsPlanner/calculations";
import {
  WEEKLY_BENCHMARK_REFERENCE,
  WEEK_STATUS_HELP,
  WEEK_STATUS_ORG_NOTE,
  allocationStatusLabel,
  defaultThroughDate,
  formatBulkApplyOutcomeStatus,
  formatMetricUnit,
  formatPlannerDisplayAbsolute,
  formatProgressDayStatus,
  formatWeekOptionLabel,
  plannerErrorMessage,
} from "@/lib/gpsPlanner/uiDisplay";
import {
  addPlannerGroupMemberAction,
  applyDailyTargetToPlayers,
  applyWeeklyTargetsToPlayers,
  createPlannerDailyTargetAction,
  createPlannerGroupAction,
  createPlannerWeekAction,
  createPlannerWeekDayAction,
  createPlannerWeekOfficialMatchAction,
  createPlannerWeeklyTargetAction,
  deletePlannerDailyTargetAction,
  deletePlannerGroupAction,
  deletePlannerWeekAction,
  deletePlannerWeekDayAction,
  deletePlannerWeekOfficialMatchByIdAction,
  deletePlannerWeeklyTargetAction,
  getPlannerMatchBestSnapshotAction,
  getPlannerWeeklyProgressAction,
  getPlannerWeeklyTargetAction,
  getPlannerWeekOfficialMatchesAction,
  listPlannerDailyTargetsForPlayerWeekAction,
  listPlannerGroupMembersAction,
  listPlannerGroupsAction,
  listPlannerWeekDaysAction,
  listPlannerWeeksAction,
  removePlannerGroupMemberAction,
  updatePlannerDailyTargetAction,
  updatePlannerGroupAction,
  updatePlannerWeekAction,
  updatePlannerWeekDayAction,
  updatePlannerWeekOfficialMatchByIdAction,
  updatePlannerWeeklyTargetAction,
} from "@/app/actions/gpsPlanner";
import type {
  ApplyDailyTargetOutcome,
  ApplyWeeklyTargetOutcome,
  PlannerDailyTargetView,
  PlannerGroupMemberRow,
  PlannerGroupRow,
  PlannerMatchBestSnapshot,
  PlannerUiPlayer,
  PlannerWeekDayRow,
  PlannerWeekOfficialMatch,
  PlannerWeekRow,
  PlannerWeeklyProgressResult,
  PlannerWeeklyTargetView,
} from "@/lib/gpsPlanner/types";
import { PlayerMappingModal } from "./PlayerMappingModal";
import { PlannerWeekMatchesFields } from "./PlannerWeekMatchesFields";
import {
  buildWeekMatchPersistPlan,
  canRemoveConfiguredMatch,
  draftFromStoredMatch,
  emptyMatchDraft,
  optionalMatchText,
  REMOVE_MATCH_1_BLOCKED_MESSAGE,
  TRAINING_MATCH_DATE_COLLISION_MESSAGE,
  validateWeekMatchDrafts,
  type WeekMatchDraft,
} from "@/lib/gpsPlanner/weekMatchForm";
import {
  buildCombinedWeekStructure,
  formatCombinedWeekKind,
  formatCombinedWeekMdDisplay,
} from "@/lib/gpsPlanner/weekStructure";

const METRIC_KEYS = ["td", "hsr", "sprint", "acc", "dec"] as const;
type MetricKey = (typeof METRIC_KEYS)[number];

const METRIC_LABEL: Record<MetricKey, string> = {
  td: "TD",
  hsr: "HSR",
  sprint: "Sprint",
  acc: "Acc",
  dec: "Dec",
};

const PCT_FIELD: Record<MetricKey, keyof PercentageMetrics> = {
  td: "tdPct",
  hsr: "hsrPct",
  sprint: "sprintPct",
  acc: "accPct",
  dec: "decPct",
};

const BEST_FIELD: Record<
  MetricKey,
  keyof Pick<
    PlannerMatchBestSnapshot,
    "tdBest" | "hsrBest" | "sprintBest" | "accBest" | "decBest"
  >
> = {
  td: "tdBest",
  hsr: "hsrBest",
  sprint: "sprintBest",
  acc: "accBest",
  dec: "decBest",
};

const EMPTY_PCT: PercentageMetrics = {
  tdPct: 0,
  hsrPct: 0,
  sprintPct: 0,
  accPct: 0,
  decPct: 0,
};

type Props = {
  initialWeeks: PlannerWeekRow[];
  players: PlannerUiPlayer[];
  /** Optional: notify shell when Planning week changes (Review can reuse). */
  onWeekIdChange?: (weekId: string) => void;
};

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function errText(code: string, message?: string): string {
  return plannerErrorMessage(code, message);
}

function pctInputsFrom(
  src: PercentageMetrics | null | undefined
): Record<MetricKey, string> {
  return {
    td: String(src?.tdPct ?? ""),
    hsr: String(src?.hsrPct ?? ""),
    sprint: String(src?.sprintPct ?? ""),
    acc: String(src?.accPct ?? ""),
    dec: String(src?.decPct ?? ""),
  };
}

function parsePctInputs(
  inputs: Record<MetricKey, string>
): PercentageMetrics | null {
  const out: Partial<PercentageMetrics> = {};
  for (const key of METRIC_KEYS) {
    const raw = inputs[key].trim();
    if (raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    out[PCT_FIELD[key]] = n;
  }
  return out as PercentageMetrics;
}

function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Delete",
  onCancel,
  onConfirm,
  busy,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-zinc-300 whitespace-pre-wrap">{body}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-[44px] rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="min-h-[44px] rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WeeklyPlannerView({
  initialWeeks,
  players,
  onWeekIdChange,
}: Props) {
  const [weeks, setWeeks] = useState(initialWeeks);
  const [weekId, setWeekId] = useState(initialWeeks[0]?.id ?? "");
  const selectedWeek = weeks.find((w) => w.id === weekId) ?? null;

  const [days, setDays] = useState<PlannerWeekDayRow[]>([]);
  const [officialMatches, setOfficialMatches] = useState<
    PlannerWeekOfficialMatch[]
  >([]);
  const [matchDrafts, setMatchDrafts] = useState<WeekMatchDraft[]>([]);
  const [groups, setGroups] = useState<PlannerGroupRow[]>([]);
  const [groupMembers, setGroupMembers] = useState<
    Record<string, PlannerGroupMemberRow[]>
  >({});

  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [focusedPlayerId, setFocusedPlayerId] = useState<string | null>(null);

  const [weeklyTarget, setWeeklyTarget] =
    useState<PlannerWeeklyTargetView | null>(null);
  const [snapshot, setSnapshot] = useState<PlannerMatchBestSnapshot | null>(
    null
  );
  const [weeklyPctInputs, setWeeklyPctInputs] = useState(pctInputsFrom(null));
  const [dailyByDayId, setDailyByDayId] = useState<
    Record<string, PlannerDailyTargetView | null>
  >({});
  const [dailyPctInputs, setDailyPctInputs] = useState<
    Record<string, Record<MetricKey, string>>
  >({});

  const [progress, setProgress] =
    useState<PlannerWeeklyProgressResult | null>(null);
  const [throughDate, setThroughDate] = useState("");
  const [progressLoading, setProgressLoading] = useState(false);
  const [matchBestLoading, setMatchBestLoading] = useState(false);

  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyOutcomes, setApplyOutcomes] = useState<
    ApplyWeeklyTargetOutcome[] | null
  >(null);
  const [dailyApplyOutcomes, setDailyApplyOutcomes] = useState<
    ApplyDailyTargetOutcome[] | null
  >(null);
  const [dailyApplyContext, setDailyApplyContext] = useState<string | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  const [confirm, setConfirm] = useState<null | {
    title: string;
    body: string;
    run: () => Promise<void>;
  }>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  /** Remount week-day edit inputs after failed/successful save so values stay in sync. */
  const [dayFormEpoch, setDayFormEpoch] = useState(0);
  const [mappingOpen, setMappingOpen] = useState(false);

  // Week form (create / edit)
  const [showWeekForm, setShowWeekForm] = useState(false);
  const [editingWeek, setEditingWeek] = useState(false);
  const [weekForm, setWeekForm] = useState({
    powerBiWeekId: "",
    startDate: "",
    endDate: "",
    weekType: "maintaining" as PlannerWeekType,
    overloadFocus: [] as OverloadFocusMetric[],
    status: "draft" as PlannerWeekStatus,
  });

  // Day form
  const [dayForm, setDayForm] = useState({
    date: "",
    mdTag: "",
    displayOrder: "0",
  });

  // Group form
  const [newGroupName, setNewGroupName] = useState("");
  const [activeGroupId, setActiveGroupId] = useState<string>("");

  const playerById = useMemo(() => {
    const m = new Map<string, PlannerUiPlayer>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

  const refreshWeeks = useCallback(async () => {
    const res = await listPlannerWeeksAction();
    if (res.ok) setWeeks(res.data);
  }, []);

  const loadWeekScoped = useCallback(async (id: string) => {
    if (!id) {
      setDays([]);
      setOfficialMatches([]);
      setGroups([]);
      setGroupMembers({});
      return;
    }
    const [dRes, gRes, mRes] = await Promise.all([
      listPlannerWeekDaysAction(id),
      listPlannerGroupsAction(id),
      getPlannerWeekOfficialMatchesAction(id),
    ]);
    if (dRes.ok) setDays(dRes.data);
    else setError(errText(dRes.error.code, dRes.error.message));
    if (mRes.ok) setOfficialMatches(mRes.data);
    else setOfficialMatches([]);
    if (gRes.ok) {
      setGroups(gRes.data);
      const memberMap: Record<string, PlannerGroupMemberRow[]> = {};
      await Promise.all(
        gRes.data.map(async (g) => {
          const m = await listPlannerGroupMembersAction(g.id);
          if (m.ok) memberMap[g.id] = m.data;
        })
      );
      setGroupMembers(memberMap);
      if (gRes.data.length > 0) {
        setActiveGroupId((prev) =>
          gRes.data.some((g) => g.id === prev) ? prev : gRes.data[0].id
        );
      } else {
        setActiveGroupId("");
      }
    }
  }, []);

  useEffect(() => {
    onWeekIdChange?.(weekId);
  }, [weekId, onWeekIdChange]);

  useEffect(() => {
    void loadWeekScoped(weekId);
  }, [weekId, loadWeekScoped]);

  useEffect(() => {
    if (!selectedWeek) {
      setThroughDate("");
      return;
    }
    setThroughDate(
      defaultThroughDate(
        selectedWeek.startDate,
        selectedWeek.endDate,
        todayIsoLocal()
      )
    );
  }, [selectedWeek]);

  const loadFocusedPlayerData = useCallback(
    async (wId: string, pId: string) => {
      setMatchBestLoading(true);
      setError(null);
      try {
        const [tRes, sRes, dRes] = await Promise.all([
          getPlannerWeeklyTargetAction(wId, pId),
          getPlannerMatchBestSnapshotAction(wId, pId),
          listPlannerDailyTargetsForPlayerWeekAction(wId, pId),
        ]);
        if (!tRes.ok) {
          setError(errText(tRes.error.code, tRes.error.message));
          setWeeklyTarget(null);
        } else {
          setWeeklyTarget(tRes.data);
          setWeeklyPctInputs(
            pctInputsFrom(
              tRes.data
                ? {
                    tdPct: tRes.data.tdPct,
                    hsrPct: tRes.data.hsrPct,
                    sprintPct: tRes.data.sprintPct,
                    accPct: tRes.data.accPct,
                    decPct: tRes.data.decPct,
                  }
                : null
            )
          );
        }
        if (sRes.ok) setSnapshot(sRes.data);
        else setSnapshot(null);

        const byDay: Record<string, PlannerDailyTargetView | null> = {};
        const inputs: Record<string, Record<MetricKey, string>> = {};
        for (const day of days) {
          byDay[day.id] = null;
          inputs[day.id] = pctInputsFrom(null);
        }
        if (dRes.ok) {
          for (const row of dRes.data) {
            byDay[row.weekDayId] = row;
            inputs[row.weekDayId] = pctInputsFrom({
              tdPct: row.tdPct,
              hsrPct: row.hsrPct,
              sprintPct: row.sprintPct,
              accPct: row.accPct,
              decPct: row.decPct,
            });
          }
        }
        setDailyByDayId(byDay);
        setDailyPctInputs(inputs);
      } finally {
        setMatchBestLoading(false);
      }
    },
    [days]
  );

  useEffect(() => {
    if (!weekId || !focusedPlayerId) {
      setWeeklyTarget(null);
      setSnapshot(null);
      setDailyByDayId({});
      setProgress(null);
      return;
    }
    void loadFocusedPlayerData(weekId, focusedPlayerId);
  }, [weekId, focusedPlayerId, days.length, loadFocusedPlayerData]);

  const loadProgress = useCallback(async () => {
    if (!weekId || !focusedPlayerId || !throughDate) {
      setProgress(null);
      return;
    }
    setProgressLoading(true);
    setError(null);
    try {
      const res = await getPlannerWeeklyProgressAction({
        weekId,
        playerId: focusedPlayerId,
        throughDate,
      });
      if (!res.ok) {
        setProgress(null);
        setError(errText(res.error.code, res.error.message));
        return;
      }
      setProgress(res.data);
    } finally {
      setProgressLoading(false);
    }
  }, [weekId, focusedPlayerId, throughDate]);

  useEffect(() => {
    if (focusedPlayerId && weeklyTarget) {
      void loadProgress();
    } else {
      setProgress(null);
    }
  }, [focusedPlayerId, weeklyTarget, throughDate, loadProgress]);

  function togglePlayer(id: string) {
    setSelectedPlayerIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      if (!focusedPlayerId && next.length === 1) setFocusedPlayerId(next[0]);
      if (focusedPlayerId === id && !next.includes(id)) {
        setFocusedPlayerId(next[0] ?? null);
      }
      return next;
    });
  }

  function selectGroupMembers(groupId: string) {
    const members = groupMembers[groupId] ?? [];
    const ids = members.map((m) => m.playerId);
    setSelectedPlayerIds(ids);
    if (ids.length > 0) setFocusedPlayerId(ids[0]);
  }

  function openCreateWeek() {
    setEditingWeek(false);
    setWeekForm({
      powerBiWeekId: "",
      startDate: "",
      endDate: "",
      weekType: "maintaining",
      overloadFocus: [],
      status: "draft",
    });
    setMatchDrafts([]);
    setShowWeekForm(true);
  }

  function openEditWeek() {
    if (!selectedWeek) return;
    setEditingWeek(true);
    setWeekForm({
      powerBiWeekId: selectedWeek.powerbiWeekId,
      startDate: selectedWeek.startDate,
      endDate: selectedWeek.endDate,
      weekType: selectedWeek.weekType,
      overloadFocus: [...selectedWeek.overloadFocus],
      status: selectedWeek.status,
    });
    setMatchDrafts(officialMatches.map(draftFromStoredMatch));
    setShowWeekForm(true);
  }

  function toggleFocusMetric(m: OverloadFocusMetric) {
    if (weekForm.weekType !== "overload") return;
    setWeekForm((f) => ({
      ...f,
      overloadFocus: f.overloadFocus.includes(m)
        ? f.overloadFocus.filter((x) => x !== m)
        : [...f.overloadFocus, m],
    }));
  }

  function matchInputFromDraft(draft: WeekMatchDraft) {
    return {
      matchOrder: draft.matchOrder,
      gpsDate: draft.gpsDate.trim(),
      mdTag: draft.mdTag.trim(),
      opponent: optionalMatchText(draft.opponent),
      matchday: optionalMatchText(draft.matchday),
      competition: optionalMatchText(draft.competition),
    };
  }

  async function persistMatchDrafts(weekIdToSave: string): Promise<string | null> {
    const plan = buildWeekMatchPersistPlan(matchDrafts);
    for (const draft of plan.update) {
      if (!draft.id) continue;
      const res = await updatePlannerWeekOfficialMatchByIdAction({
        id: draft.id,
        weekId: weekIdToSave,
        ...matchInputFromDraft(draft),
      });
      if (!res.ok) {
        return `Match ${draft.matchOrder} was not saved. ${errText(res.error.code, res.error.message)}`;
      }
    }
    for (const draft of plan.create) {
      const res = await createPlannerWeekOfficialMatchAction({
        weekId: weekIdToSave,
        ...matchInputFromDraft(draft),
      });
      if (!res.ok) {
        return `Match ${draft.matchOrder} was not saved. ${errText(res.error.code, res.error.message)}`;
      }
    }
    return null;
  }

  function addMatchDraft() {
    setMatchDrafts((prev) => {
      if (prev.length >= 2) return prev;
      const nextOrder: 1 | 2 = prev.some((d) => d.matchOrder === 1) ? 2 : 1;
      if (prev.some((d) => d.matchOrder === nextOrder)) return prev;
      return [...prev, emptyMatchDraft(nextOrder)];
    });
  }

  function askRemoveMatchDraft(draft: WeekMatchDraft) {
    if (!canRemoveConfiguredMatch(matchDrafts, draft.matchOrder)) {
      setError(REMOVE_MATCH_1_BLOCKED_MESSAGE);
      return;
    }
    if (!draft.id) {
      setMatchDrafts((prev) =>
        prev.filter((item) => item.matchOrder !== draft.matchOrder)
      );
      return;
    }
    if (!selectedWeek) return;
    setConfirm({
      title: `Remove Match ${draft.matchOrder}?`,
      body: `Remove Match ${draft.matchOrder}${draft.gpsDate ? ` (${draft.gpsDate})` : ""} from this week?`,
      run: async () => {
        const res = await deletePlannerWeekOfficialMatchByIdAction({
          id: draft.id!,
          weekId: selectedWeek.id,
        });
        if (!res.ok) {
          setError(errText(res.error.code, res.error.message));
          return;
        }
        setMatchDrafts((prev) => prev.filter((item) => item.id !== draft.id));
        setFlash(`Match ${draft.matchOrder} removed.`);
        await loadWeekScoped(selectedWeek.id);
      },
    });
  }

  function saveWeekForm() {
    setError(null);
    setFlash(null);
    const trainingDates = editingWeek ? days.map((day) => day.date) : [];
    const matchError = validateWeekMatchDrafts(matchDrafts, trainingDates);
    if (matchError) {
      setError(errText(matchError.code, matchError.message));
      return;
    }
    startTransition(async () => {
      const focus =
        weekForm.weekType === "overload" ? weekForm.overloadFocus : [];
      if (editingWeek && selectedWeek) {
        const res = await updatePlannerWeekAction({
          weekId: selectedWeek.id,
          powerBiWeekId: weekForm.powerBiWeekId,
          startDate: weekForm.startDate,
          endDate: weekForm.endDate,
          weekType: weekForm.weekType,
          overloadFocus: focus,
          status: weekForm.status,
        });
        if (!res.ok) {
          setError(errText(res.error.code, res.error.message));
          return;
        }
        const matchSaveError = await persistMatchDrafts(selectedWeek.id);
        if (matchSaveError) {
          setError(`Week updated, but ${matchSaveError}`);
          await loadWeekScoped(selectedWeek.id);
          return;
        }
        setFlash("Week updated.");
      } else {
        const res = await createPlannerWeekAction({
          powerBiWeekId: weekForm.powerBiWeekId,
          startDate: weekForm.startDate,
          endDate: weekForm.endDate,
          weekType: weekForm.weekType,
          overloadFocus: focus,
          status: weekForm.status,
        });
        if (!res.ok) {
          setError(errText(res.error.code, res.error.message));
          return;
        }
        setWeekId(res.data.id);
        const matchSaveError = await persistMatchDrafts(res.data.id);
        if (matchSaveError) {
          setError(`Week created, but ${matchSaveError}`);
          setShowWeekForm(false);
          await refreshWeeks();
          await loadWeekScoped(res.data.id);
          return;
        }
        setFlash("Week created.");
      }
      setShowWeekForm(false);
      await refreshWeeks();
      if (editingWeek && selectedWeek) await loadWeekScoped(selectedWeek.id);
    });
  }

  function askDeleteWeek() {
    if (!selectedWeek) return;
    setConfirm({
      title: "Delete planner week?",
      body: `Delete ${formatWeekOptionLabel(selectedWeek.powerbiWeekId, selectedWeek.startDate, selectedWeek.endDate)}?\n\nThis permanently deletes week days, groups, Match Best snapshots, weekly targets, and daily targets for this week.\n\nPower BI data and player mappings are not deleted.`,
      run: async () => {
        const res = await deletePlannerWeekAction({
          weekId: selectedWeek.id,
          confirm: true,
        });
        if (!res.ok) {
          setError(errText(res.error.code, res.error.message));
          return;
        }
        setFlash("Week deleted.");
        await refreshWeeks();
        setWeekId((prev) => {
          const remaining = weeks.filter((w) => w.id !== prev);
          return remaining[0]?.id ?? "";
        });
      },
    });
  }

  function addDay() {
    if (!weekId) return;
    const displayOrder = Number(dayForm.displayOrder);
    setError(null);
    if (
      officialMatches.some((match) => match.gpsDate === dayForm.date) ||
      matchDrafts.some((draft) => draft.gpsDate === dayForm.date)
    ) {
      setError(TRAINING_MATCH_DATE_COLLISION_MESSAGE);
      return;
    }
    startTransition(async () => {
      const res = await createPlannerWeekDayAction({
        weekId,
        date: dayForm.date,
        mdTag: dayForm.mdTag,
        displayOrder,
      });
      if (!res.ok) {
        setError(errText(res.error.code, res.error.message));
        return;
      }
      setFlash("Week day added.");
      setDayForm({ date: "", mdTag: "", displayOrder: String(days.length + 1) });
      await loadWeekScoped(weekId);
    });
  }

  function askDeleteDay(day: PlannerWeekDayRow) {
    setConfirm({
      title: "Delete week day?",
      body: `Delete ${day.mdTag} (${day.date})?\n\nDaily Targets for this day will cascade-delete.\nActual GPS data stays in Power BI (not deleted).`,
      run: async () => {
        const res = await deletePlannerWeekDayAction({
          weekDayId: day.id,
          confirm: true,
        });
        if (!res.ok) {
          setError(errText(res.error.code, res.error.message));
          return;
        }
        setFlash("Week day deleted.");
        await loadWeekScoped(weekId);
      },
    });
  }

  function saveDay(day: PlannerWeekDayRow, patch: Partial<PlannerWeekDayRow>) {
    const nextDate = patch.date ?? day.date;
    if (
      nextDate !== day.date &&
      officialMatches.some((match) => match.gpsDate === nextDate)
    ) {
      setError(TRAINING_MATCH_DATE_COLLISION_MESSAGE);
      setDayFormEpoch((n) => n + 1);
      return;
    }
    startTransition(async () => {
      const res = await updatePlannerWeekDayAction({
        dayId: day.id,
        date: patch.date ?? day.date,
        mdTag: patch.mdTag ?? day.mdTag,
        displayOrder: patch.displayOrder ?? day.displayOrder,
      });
      if (!res.ok) {
        setError(errText(res.error.code, res.error.message));
        setDayFormEpoch((n) => n + 1);
        return;
      }
      await loadWeekScoped(weekId);
      setDayFormEpoch((n) => n + 1);
    });
  }

  function createGroup() {
    if (!weekId || !newGroupName.trim()) return;
    startTransition(async () => {
      const res = await createPlannerGroupAction({
        weekId,
        name: newGroupName,
      });
      if (!res.ok) {
        setError(errText(res.error.code, res.error.message));
        return;
      }
      setNewGroupName("");
      setFlash("Group created.");
      await loadWeekScoped(weekId);
    });
  }

  function renameGroup(group: PlannerGroupRow, name: string) {
    startTransition(async () => {
      const res = await updatePlannerGroupAction({ groupId: group.id, name });
      if (!res.ok) {
        setError(errText(res.error.code, res.error.message));
        return;
      }
      await loadWeekScoped(weekId);
    });
  }

  function askDeleteGroup(group: PlannerGroupRow) {
    setConfirm({
      title: "Delete group?",
      body: `Delete group “${group.name}”? Members are removed from the helper only — player targets are unchanged.`,
      run: async () => {
        const res = await deletePlannerGroupAction(group.id);
        if (!res.ok) {
          setError(errText(res.error.code, res.error.message));
          return;
        }
        setFlash("Group deleted.");
        await loadWeekScoped(weekId);
      },
    });
  }

  function addMemberToGroup(groupId: string, playerId: string) {
    startTransition(async () => {
      const res = await addPlannerGroupMemberAction({ groupId, playerId });
      if (!res.ok) {
        setError(errText(res.error.code, res.error.message));
        return;
      }
      await loadWeekScoped(weekId);
    });
  }

  function removeMember(groupId: string, playerId: string) {
    startTransition(async () => {
      const res = await removePlannerGroupMemberAction({ groupId, playerId });
      if (!res.ok) {
        setError(errText(res.error.code, res.error.message));
        return;
      }
      await loadWeekScoped(weekId);
    });
  }

  function saveWeeklyForFocused() {
    if (!weekId || !focusedPlayerId) return;
    const pct = parsePctInputs(weeklyPctInputs);
    if (!pct) {
      setError("Enter valid weekly percentages (≥ 0) for all metrics.");
      return;
    }
    setError(null);
    setMatchBestLoading(true);
    startTransition(async () => {
      try {
        if (weeklyTarget) {
          const res = await updatePlannerWeeklyTargetAction({
            weekId,
            playerId: focusedPlayerId,
            ...pct,
          });
          if (!res.ok) {
            setError(errText(res.error.code, res.error.message));
            return;
          }
          setWeeklyTarget(res.data);
          setFlash("Weekly target updated.");
        } else {
          const res = await createPlannerWeeklyTargetAction({
            weekId,
            playerId: focusedPlayerId,
            ...pct,
          });
          if (!res.ok) {
            setError(errText(res.error.code, res.error.message));
            return;
          }
          setWeeklyTarget(res.data);
          setSnapshot({
            weekId: res.data.weekId,
            playerId: res.data.playerId,
            tdBest: res.data.tdBest,
            hsrBest: res.data.hsrBest,
            sprintBest: res.data.sprintBest,
            accBest: res.data.accBest,
            decBest: res.data.decBest,
            powerBiPlayerName: res.data.powerBiPlayerName,
            sourceMethod: res.data.sourceMethod,
            createdAt: res.data.createdAt,
            createdBy: res.data.createdBy,
          });
          setFlash(
            res.data.snapshotCreated
              ? "Weekly target created (Match Best snapshot frozen)."
              : "Weekly target created (existing Match Best reused)."
          );
        }
        await loadFocusedPlayerData(weekId, focusedPlayerId);
      } finally {
        setMatchBestLoading(false);
      }
    });
  }

  function askDeleteWeekly() {
    if (!weekId || !focusedPlayerId || !weeklyTarget) return;
    setConfirm({
      title: "Delete weekly target?",
      body: "Delete this player’s Weekly Target? Daily Targets for the week/player will cascade. The frozen Match Best snapshot is kept.",
      run: async () => {
        const res = await deletePlannerWeeklyTargetAction({
          weekId,
          playerId: focusedPlayerId,
          confirm: true,
        });
        if (!res.ok) {
          setError(errText(res.error.code, res.error.message));
          return;
        }
        setFlash("Weekly target deleted.");
        await loadFocusedPlayerData(weekId, focusedPlayerId);
      },
    });
  }

  function applyToSelected() {
    if (!weekId || selectedPlayerIds.length === 0) return;
    const pct = parsePctInputs(weeklyPctInputs);
    if (!pct) {
      setError("Enter valid weekly percentages before applying to players.");
      return;
    }
    setApplyOutcomes(null);
    setError(null);
    startTransition(async () => {
      const res = await applyWeeklyTargetsToPlayers({
        weekId,
        playerIds: selectedPlayerIds,
        ...pct,
      });
      if (!res.ok) {
        setError(errText(res.error.code, res.error.message));
        return;
      }
      setApplyOutcomes(res.data);
      setFlash("Apply finished — see per-player outcomes.");
      if (focusedPlayerId) {
        await loadFocusedPlayerData(weekId, focusedPlayerId);
      }
    });
  }

  function saveDaily(dayId: string) {
    if (!weekId || !focusedPlayerId) return;
    const inputs = dailyPctInputs[dayId];
    if (!inputs) return;
    const pct = parsePctInputs(inputs);
    if (!pct) {
      setError("Enter valid daily percentages (≥ 0) for all metrics.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const existing = dailyByDayId[dayId];
      const res = existing
        ? await updatePlannerDailyTargetAction({
            weekDayId: dayId,
            playerId: focusedPlayerId,
            ...pct,
          })
        : await createPlannerDailyTargetAction({
            weekDayId: dayId,
            playerId: focusedPlayerId,
            ...pct,
          });
      if (!res.ok) {
        setError(errText(res.error.code, res.error.message));
        return;
      }
      setFlash(existing ? "Daily target updated." : "Daily target created.");
      await loadFocusedPlayerData(weekId, focusedPlayerId);
    });
  }

  function applyDailyToSelected(dayId: string) {
    if (!weekId || selectedPlayerIds.length === 0) return;
    const inputs = dailyPctInputs[dayId];
    if (!inputs) return;
    const pct = parsePctInputs(inputs);
    if (!pct) {
      setError("Enter valid daily percentages (≥ 0) for all metrics.");
      return;
    }
    const day = days.find((d) => d.id === dayId);
    setDailyApplyOutcomes(null);
    setDailyApplyContext(day ? `${day.mdTag} · ${day.date}` : dayId);
    setError(null);
    startTransition(async () => {
      const res = await applyDailyTargetToPlayers({
        weekDayId: dayId,
        playerIds: selectedPlayerIds,
        ...pct,
      });
      if (!res.ok) {
        setError(errText(res.error.code, res.error.message));
        return;
      }
      setDailyApplyOutcomes(res.data);
      setFlash("Daily apply finished — see per-player outcomes.");
      if (focusedPlayerId) {
        await loadFocusedPlayerData(weekId, focusedPlayerId);
      }
    });
  }

  function askDeleteDaily(dayId: string) {
    if (!focusedPlayerId || !dailyByDayId[dayId]) return;
    setConfirm({
      title: "Delete daily target?",
      body: "Delete this Daily Target only. Weekly Target and Match Best snapshot stay.",
      run: async () => {
        const res = await deletePlannerDailyTargetAction({
          weekDayId: dayId,
          playerId: focusedPlayerId,
          confirm: true,
        });
        if (!res.ok) {
          setError(errText(res.error.code, res.error.message));
          return;
        }
        setFlash("Daily target deleted.");
        await loadFocusedPlayerData(weekId, focusedPlayerId);
      },
    });
  }

  const weeklyPctParsed = parsePctInputs(weeklyPctInputs);
  const plannedFromInputs =
    snapshot && weeklyPctParsed
      ? calculatePlannedAbsolutes(
          {
            tdBest: snapshot.tdBest,
            hsrBest: snapshot.hsrBest,
            sprintBest: snapshot.sprintBest,
            accBest: snapshot.accBest,
            decBest: snapshot.decBest,
          },
          weeklyPctParsed
        )
      : weeklyTarget
        ? {
            totalDistance: weeklyTarget.totalDistance,
            hsr: weeklyTarget.hsr,
            sprint: weeklyTarget.sprint,
            accelerations: weeklyTarget.accelerations,
            decelerations: weeklyTarget.decelerations,
          }
        : null;

  const combinedWeek = useMemo(
    () => buildCombinedWeekStructure(days, officialMatches),
    [days, officialMatches]
  );

  const dailySum = useMemo(() => {
    const rows: PercentageMetrics[] = [];
    for (const day of days) {
      const parsed = dailyPctInputs[day.id]
        ? parsePctInputs(dailyPctInputs[day.id])
        : null;
      if (parsed) rows.push(parsed);
      else if (dailyByDayId[day.id]) {
        const d = dailyByDayId[day.id]!;
        rows.push({
          tdPct: d.tdPct,
          hsrPct: d.hsrPct,
          sprintPct: d.sprintPct,
          accPct: d.accPct,
          decPct: d.decPct,
        });
      }
    }
    return sumPercentageMetrics(rows);
  }, [days, dailyPctInputs, dailyByDayId]);

  const remaining =
    weeklyPctParsed != null
      ? remainingToAllocate(weeklyPctParsed, dailySum)
      : weeklyTarget
        ? remainingToAllocate(
            {
              tdPct: weeklyTarget.tdPct,
              hsrPct: weeklyTarget.hsrPct,
              sprintPct: weeklyTarget.sprintPct,
              accPct: weeklyTarget.accPct,
              decPct: weeklyTarget.decPct,
            },
            dailySum
          )
        : null;

  const refRanges =
    selectedWeek != null
      ? WEEKLY_BENCHMARK_REFERENCE.ranges[selectedWeek.weekType]
      : null;

  const focusedPlayer = focusedPlayerId
    ? playerById.get(focusedPlayerId)
    : null;

  async function runConfirm() {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await confirm.run();
      setConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {(error || flash) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            error
              ? "border-red-700/50 bg-red-950/30 text-red-200"
              : "border-emerald-700/50 bg-emerald-950/30 text-emerald-200"
          }`}
        >
          {error ?? flash}
        </div>
      )}

      {/* HEADER — Week */}
      <Card title="Week">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <label className="block text-xs font-medium text-zinc-400">
              Planner week
            </label>
            <select
              value={weekId}
              onChange={(e) => setWeekId(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-white"
            >
              {weeks.length === 0 && (
                <option value="">No weeks yet — create one with New week</option>
              )}
              {weeks.map((w) => (
                <option key={w.id} value={w.id}>
                  {formatWeekOptionLabel(
                    w.powerbiWeekId,
                    w.startDate,
                    w.endDate
                  )}{" "}
                  · {w.weekType} · {WEEK_STATUS_HELP[w.status].label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMappingOpen(true)}
              className="min-h-[44px] rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              Player Mapping
            </button>
            <button
              type="button"
              onClick={openCreateWeek}
              className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              New week
            </button>
            <button
              type="button"
              onClick={openEditWeek}
              disabled={!selectedWeek}
              className="min-h-[44px] rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={askDeleteWeek}
              disabled={!selectedWeek}
              className="min-h-[44px] rounded-lg border border-red-800/60 px-4 py-2 text-sm text-red-300 hover:bg-red-950/40 disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </div>

        {selectedWeek && !showWeekForm && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <p className="text-xs text-zinc-500">Week type</p>
              <p className="text-zinc-200 capitalize">{selectedWeek.weekType}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Overload focus</p>
              <p className="text-zinc-200">
                {selectedWeek.weekType === "overload"
                  ? selectedWeek.overloadFocus.length
                    ? selectedWeek.overloadFocus.join(", ")
                    : "General (none)"
                  : "— (not overload)"}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Status</p>
              <p className="text-zinc-200">
                {WEEK_STATUS_HELP[selectedWeek.status].label}
              </p>
              <p className="text-[11px] text-zinc-500">
                {WEEK_STATUS_HELP[selectedWeek.status].meaning}.{" "}
                {WEEK_STATUS_ORG_NOTE}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Power BI Week ID</p>
              <p className="text-zinc-200">{selectedWeek.powerbiWeekId}</p>
            </div>
          </div>
        )}

        {showWeekForm && (
          <div className="mt-4 space-y-4 rounded-lg border border-zinc-700/60 bg-zinc-950/40 p-4">
            <p className="text-sm font-medium text-white">
              {editingWeek ? "Edit week" : "Create week"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Power BI Week ID">
                <input
                  value={weekForm.powerBiWeekId}
                  onChange={(e) =>
                    setWeekForm((f) => ({
                      ...f,
                      powerBiWeekId: e.target.value,
                    }))
                  }
                  placeholder="W6"
                  className={inputClass}
                />
              </Field>
              <Field label="Status" hint={WEEK_STATUS_ORG_NOTE}>
                <select
                  value={weekForm.status}
                  onChange={(e) =>
                    setWeekForm((f) => ({
                      ...f,
                      status: e.target.value as PlannerWeekStatus,
                    }))
                  }
                  className={inputClass}
                >
                  {WEEK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {WEEK_STATUS_HELP[s].label} — {WEEK_STATUS_HELP[s].meaning}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Start date">
                <input
                  type="date"
                  value={weekForm.startDate}
                  onChange={(e) =>
                    setWeekForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="End date">
                <input
                  type="date"
                  value={weekForm.endDate}
                  onChange={(e) =>
                    setWeekForm((f) => ({ ...f, endDate: e.target.value }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Week type">
                <select
                  value={weekForm.weekType}
                  onChange={(e) => {
                    const weekType = e.target.value as PlannerWeekType;
                    setWeekForm((f) => ({
                      ...f,
                      weekType,
                      // Never auto-change %; clear focus when leaving overload
                      overloadFocus:
                        weekType === "overload" ? f.overloadFocus : [],
                    }));
                  }}
                  className={inputClass}
                >
                  {WEEK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-400">
                Overload focus (informational only — does not change %)
              </p>
              <div className="flex flex-wrap gap-2">
                {OVERLOAD_FOCUS_VALUES.map((m) => (
                  <label
                    key={m}
                    className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                      weekForm.weekType !== "overload"
                        ? "cursor-not-allowed border-zinc-800 text-zinc-600"
                        : weekForm.overloadFocus.includes(m)
                          ? "border-emerald-600/50 bg-emerald-950/30 text-emerald-200"
                          : "border-zinc-700 text-zinc-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={weekForm.weekType !== "overload"}
                      checked={weekForm.overloadFocus.includes(m)}
                      onChange={() => toggleFocusMetric(m)}
                      className="rounded border-zinc-600"
                    />
                    {m.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
            <PlannerWeekMatchesFields
              drafts={matchDrafts}
              onChange={setMatchDrafts}
              onRemove={askRemoveMatchDraft}
              onAdd={addMatchDraft}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveWeekForm}
                disabled={pending}
                className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save week"}
              </button>
              <button
                type="button"
                onClick={() => setShowWeekForm(false)}
                className="min-h-[44px] rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Week days */}
      <Card title="Week days">
        {!weekId ? (
          <p className="text-sm text-zinc-400">Select or create a week first.</p>
        ) : (
          <>
            <div className="space-y-3 sm:hidden">
              {combinedWeek.map((item) => {
                if (item.type === "match") {
                  return (
                    <div
                      key={item.matchId}
                      className="rounded-xl border border-zinc-600 bg-zinc-900/50 p-3"
                    >
                      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-300">
                        {formatCombinedWeekKind(item)}
                      </p>
                      <p className="mt-1 text-sm text-white">{item.date}</p>
                      <p className="text-sm text-zinc-300">{item.mdTag}</p>
                      <p className="mt-2 text-xs text-zinc-500">Edit in Week</p>
                    </div>
                  );
                }
                const day = days.find((d) => d.id === item.trainingDayId);
                if (!day) return null;
                return (
                  <div
                    key={`${day.id}-${dayFormEpoch}-m`}
                    className="space-y-3 rounded-xl border border-zinc-800 p-3"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                      Training
                    </p>
                    <Field label="Date">
                      <input
                        type="date"
                        defaultValue={day.date}
                        onBlur={(e) => {
                          if (e.target.value !== day.date) {
                            saveDay(day, { date: e.target.value });
                          }
                        }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="MD tag">
                      <input
                        defaultValue={day.mdTag}
                        onBlur={(e) => {
                          if (e.target.value.trim() !== day.mdTag) {
                            saveDay(day, { mdTag: e.target.value.trim() });
                          }
                        }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Order">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        defaultValue={day.displayOrder}
                        onBlur={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isInteger(n) && n !== day.displayOrder) {
                            saveDay(day, { displayOrder: n });
                          }
                        }}
                        className={inputClass}
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={() => askDeleteDay(day)}
                      className="min-h-[44px] rounded-lg border border-red-800/50 px-3 text-xs text-red-300 hover:bg-red-950/30"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
              {combinedWeek.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No days yet — add a date and MD tag below.
                </p>
              ) : null}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">MD tag</th>
                    <th className="py-2 pr-3 font-medium">Kind</th>
                    <th className="py-2 pr-3 font-medium">Order</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedWeek.map((item) => {
                    if (item.type === "match") {
                      return (
                        <tr
                          key={item.matchId}
                          className="border-b border-zinc-800/60 bg-zinc-900/50"
                        >
                          <td className="py-2 pr-3 text-zinc-200">{item.date}</td>
                          <td className="py-2 pr-3 text-zinc-200">{item.mdTag}</td>
                          <td className="py-2 pr-3">
                            <span className="inline-flex min-h-[28px] items-center rounded-md border border-zinc-600 bg-zinc-800/70 px-2 text-[11px] font-medium uppercase tracking-wide text-zinc-200">
                              {formatCombinedWeekKind(item)}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-zinc-500">—</td>
                          <td className="py-2 text-xs text-zinc-500">
                            Edit in Week
                          </td>
                        </tr>
                      );
                    }
                    const day = days.find((d) => d.id === item.trainingDayId);
                    if (!day) return null;
                    return (
                      <tr
                        key={`${day.id}-${dayFormEpoch}`}
                        className="border-b border-zinc-800/60"
                      >
                        <td className="py-2 pr-3">
                          <input
                            type="date"
                            defaultValue={day.date}
                            onBlur={(e) => {
                              if (e.target.value !== day.date) {
                                saveDay(day, { date: e.target.value });
                              }
                            }}
                            className={inputClass}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            defaultValue={day.mdTag}
                            onBlur={(e) => {
                              if (e.target.value.trim() !== day.mdTag) {
                                saveDay(day, { mdTag: e.target.value.trim() });
                              }
                            }}
                            className={inputClass}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <span className="inline-flex min-h-[28px] items-center rounded-md border border-zinc-700 px-2 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                            Training
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            defaultValue={day.displayOrder}
                            onBlur={(e) => {
                              const n = Number(e.target.value);
                              if (
                                Number.isInteger(n) &&
                                n !== day.displayOrder
                              ) {
                                saveDay(day, { displayOrder: n });
                              }
                            }}
                            className={`${inputClass} w-20`}
                          />
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => askDeleteDay(day)}
                            className="min-h-[40px] rounded-lg border border-red-800/50 px-3 text-xs text-red-300 hover:bg-red-950/30"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {combinedWeek.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-zinc-500">
                        No days yet — add a date and MD tag below.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Field label="Date">
                <input
                  type="date"
                  value={dayForm.date}
                  onChange={(e) =>
                    setDayForm((f) => ({ ...f, date: e.target.value }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="MD tag">
                <input
                  value={dayForm.mdTag}
                  onChange={(e) =>
                    setDayForm((f) => ({ ...f, mdTag: e.target.value }))
                  }
                  placeholder="MD-3"
                  className={inputClass}
                />
              </Field>
              <Field
                label="Order"
                hint="Controls the order of days in the Planner."
              >
                <input
                  type="number"
                  min={0}
                  value={dayForm.displayOrder}
                  onChange={(e) =>
                    setDayForm((f) => ({ ...f, displayOrder: e.target.value }))
                  }
                  className={inputClass}
                />
              </Field>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={addDay}
                  disabled={pending}
                  className="min-h-[44px] w-full rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Add day
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Players + groups */}
      <Card title="Players">
        <p className="mb-3 text-xs text-zinc-500">
          Check players to apply Weekly/Daily percentages in bulk. Focus one
          player to edit details. Groups are optional selection helpers — they
          do not own targets.
        </p>
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedPlayerIds(players.map((p) => p.id));
                  if (players[0]) setFocusedPlayerId(players[0].id);
                }}
                className="min-h-[36px] rounded-lg border border-zinc-700 px-3 text-xs text-zinc-300"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedPlayerIds([]);
                  setFocusedPlayerId(null);
                }}
                className="min-h-[36px] rounded-lg border border-zinc-700 px-3 text-xs text-zinc-300"
              >
                Clear
              </button>
            </div>
            <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-zinc-800 p-2">
              {players.map((p) => {
                const checked = selectedPlayerIds.includes(p.id);
                const focused = focusedPlayerId === p.id;
                return (
                  <li
                    key={p.id}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                      focused ? "bg-emerald-950/40 ring-1 ring-emerald-700/40" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePlayer(p.id)}
                      className="size-4 rounded border-zinc-600"
                    />
                    <button
                      type="button"
                      onClick={() => setFocusedPlayerId(p.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {p.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.avatarUrl}
                          alt=""
                          className="size-8 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-400">
                          {p.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="truncate text-sm text-zinc-100">
                        {p.name}
                      </span>
                    </button>
                  </li>
                );
              })}
              {players.length === 0 && (
                <li className="px-2 py-4 text-sm text-zinc-500">
                  No player profiles found.
                </li>
              )}
            </ul>
            <p className="mt-2 text-xs text-zinc-500">
              {selectedPlayerIds.length} selected
              {focusedPlayer
                ? ` · focused: ${focusedPlayer.name}`
                : ""}
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-zinc-200">Groups</p>
              <p className="text-xs text-zinc-500">
                Optional — use groups only to select players faster.
              </p>
            </div>
            <div className="flex gap-2">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Starters"
                className={inputClass}
              />
              <button
                type="button"
                onClick={createGroup}
                disabled={!weekId || pending}
                className="min-h-[44px] shrink-0 rounded-lg bg-emerald-600 px-3 text-sm text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                Add
              </button>
            </div>
            <select
              value={activeGroupId}
              onChange={(e) => setActiveGroupId(e.target.value)}
              className={inputClass}
            >
              {groups.length === 0 && <option value="">No groups</option>}
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            {activeGroupId && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => selectGroupMembers(activeGroupId)}
                    className="min-h-[36px] rounded-lg border border-emerald-700/50 px-3 text-xs text-emerald-300"
                  >
                    Select members
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const g = groups.find((x) => x.id === activeGroupId);
                      if (!g) return;
                      const name = window.prompt("Rename group", g.name);
                      if (name && name.trim()) renameGroup(g, name.trim());
                    }}
                    className="min-h-[36px] rounded-lg border border-zinc-700 px-3 text-xs text-zinc-300"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const g = groups.find((x) => x.id === activeGroupId);
                      if (g) askDeleteGroup(g);
                    }}
                    className="min-h-[36px] rounded-lg border border-red-800/50 px-3 text-xs text-red-300"
                  >
                    Delete group
                  </button>
                </div>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                  {(groupMembers[activeGroupId] ?? []).map((m) => (
                    <li
                      key={m.playerId}
                      className="flex items-center justify-between gap-2 rounded px-2 py-1 text-zinc-300"
                    >
                      <span className="truncate">{m.playerDisplayName}</span>
                      <button
                        type="button"
                        onClick={() =>
                          removeMember(activeGroupId, m.playerId)
                        }
                        className="text-xs text-red-400"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      addMemberToGroup(activeGroupId, e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className={inputClass}
                >
                  <option value="">Add player…</option>
                  {players
                    .filter(
                      (p) =>
                        !(groupMembers[activeGroupId] ?? []).some(
                          (m) => m.playerId === p.id
                        )
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Weekly targets */}
      <Card title="Weekly targets">
        {!focusedPlayerId ? (
          <p className="text-sm text-zinc-400">
            Select a focused player, then enter Weekly % (e.g. 135 = 135%). Use
            Player Mapping first if Match Best is missing.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-zinc-300">
                Focused:{" "}
                <span className="font-medium text-white">
                  {focusedPlayer?.name}
                </span>
                {matchBestLoading && (
                  <span className="ml-2 text-xs text-zinc-500">Loading…</span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveWeeklyForFocused}
                  disabled={pending || matchBestLoading}
                  className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Save Weekly
                </button>
                <button
                  type="button"
                  onClick={applyToSelected}
                  disabled={
                    pending || selectedPlayerIds.length === 0 || matchBestLoading
                  }
                  className="min-h-[44px] rounded-lg border border-emerald-700/50 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-950/30 disabled:opacity-40"
                >
                  Apply to {selectedPlayerIds.length} selected
                </button>
                {weeklyTarget && (
                  <button
                    type="button"
                    onClick={askDeleteWeekly}
                    className="min-h-[44px] rounded-lg border border-red-800/50 px-4 py-2 text-sm text-red-300"
                  >
                    Delete weekly
                  </button>
                )}
              </div>
            </div>

            {refRanges && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
                <span className="font-medium text-zinc-300">
                  {WEEKLY_BENCHMARK_REFERENCE.label}
                </span>
                {" · "}
                {selectedWeek?.weekType}: TD {refRanges.td}, HSR {refRanges.hsr},
                Sprint {refRanges.sprint}, Acc {refRanges.acc}, Dec {refRanges.dec}
                . Not auto-filled.
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="py-2 pr-2 text-left font-medium">Metric</th>
                    <th className="py-2 pr-2 text-left font-medium">
                      Weekly %{" "}
                      <span className="font-normal text-zinc-500">
                        (135 = 135%)
                      </span>
                    </th>
                    <th className="py-2 pr-2 text-left font-medium">
                      Match Best{" "}
                      <span className="font-normal text-zinc-500">
                        (frozen · read-only)
                      </span>
                    </th>
                    <th className="py-2 text-left font-medium">
                      Planned{" "}
                      <span className="font-normal text-zinc-500">
                        (from % × Match Best)
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {METRIC_KEYS.map((key) => {
                    const unit = formatMetricUnit(key);
                    const best =
                      snapshot?.[BEST_FIELD[key]] ??
                      weeklyTarget?.[BEST_FIELD[key]] ??
                      null;
                    const plannedAbs =
                      plannedFromInputs == null
                        ? null
                        : key === "td"
                          ? plannedFromInputs.totalDistance
                          : key === "hsr"
                            ? plannedFromInputs.hsr
                            : key === "sprint"
                              ? plannedFromInputs.sprint
                              : key === "acc"
                                ? plannedFromInputs.accelerations
                                : plannedFromInputs.decelerations;
                    return (
                      <tr key={key} className="border-b border-zinc-800/50">
                        <td className="py-2 pr-2 text-zinc-200">
                          {METRIC_LABEL[key]}
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            inputMode="decimal"
                            value={weeklyPctInputs[key]}
                            onChange={(e) =>
                              setWeeklyPctInputs((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            className={`${inputClass} w-28`}
                            placeholder="%"
                          />
                        </td>
                        <td className="py-2 pr-2 text-zinc-400">
                          {best == null
                            ? "—"
                            : `${formatPlannerDisplayAbsolute(best)} ${unit}`}
                        </td>
                        <td className="py-2 text-zinc-200">
                          {plannedAbs == null
                            ? "—"
                            : `${formatPlannerDisplayAbsolute(plannedAbs)} ${unit}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {(snapshot || weeklyTarget) && (
              <p className="text-xs text-zinc-500">
                Match Best reference for this week:{" "}
                <span className="text-zinc-300">
                  {snapshot?.powerBiPlayerName ??
                    weeklyTarget?.powerBiPlayerName}
                </span>{" "}
                (frozen — not editable)
              </p>
            )}

            {applyOutcomes && (
              <div className="rounded-lg border border-zinc-700/60 p-3">
                <p className="mb-2 text-sm font-medium text-zinc-200">
                  Weekly apply outcomes
                </p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                  {applyOutcomes.map((o) => {
                    const fmt = formatBulkApplyOutcomeStatus(o.status);
                    return (
                      <li key={o.playerId} className="flex gap-2 text-zinc-300">
                        <span
                          className={
                            fmt.tone === "fail"
                              ? "text-red-400"
                              : "text-emerald-400"
                          }
                        >
                          {fmt.mark} {fmt.label}
                        </span>
                        <span>
                          — {playerById.get(o.playerId)?.name ?? o.playerId}
                        </span>
                        {o.message && (
                          <span className="text-zinc-500">· {o.message}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Daily distribution */}
      <Card title="Daily distribution">
        {!focusedPlayerId || !weeklyTarget ? (
          <p className="text-sm text-zinc-400">
            Create a Weekly Target for the focused player first, then distribute
            daily %.
          </p>
        ) : days.length === 0 ? (
          <p className="text-sm text-zinc-400">Add week days first.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500">
              Daily % is of frozen Match Best (not of Weekly Target). Same % can
              be applied to selected players; planned meters/counts stay
              player-specific. Values below are for the focused player. Example:
              50 = 50%.
            </p>
            {remaining && (
              <div className="flex flex-wrap gap-2 text-xs">
                {METRIC_KEYS.map((key) => {
                  const rem = remaining[PCT_FIELD[key]];
                  const label = allocationStatusLabel(rem);
                  const color =
                    label.kind === "over"
                      ? "border-amber-700/50 text-amber-200"
                      : label.kind === "full"
                        ? "border-emerald-700/50 text-emerald-200"
                        : "border-zinc-700 text-zinc-300";
                  return (
                    <span
                      key={key}
                      className={`rounded-lg border px-2.5 py-1 ${color}`}
                    >
                      {METRIC_LABEL[key]}: {label.text}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="flex gap-3 overflow-x-auto pb-2">
              {combinedWeek.map((item) => {
                if (item.type === "match") {
                  return (
                    <div
                      key={item.matchId}
                      className="w-[260px] shrink-0 rounded-xl border border-zinc-600 bg-zinc-900/50 p-3"
                    >
                      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-300">
                        {formatCombinedWeekKind(item)}
                      </p>
                      <p className="font-medium text-white">
                        {formatCombinedWeekMdDisplay(item)}
                      </p>
                      <p className="text-xs text-zinc-500">{item.date}</p>
                      <div className="mt-3 space-y-2">
                        {METRIC_KEYS.map((key) => (
                          <div key={key}>
                            <p className="text-xs text-zinc-500">
                              {METRIC_LABEL[key]}
                            </p>
                            <p className="text-sm text-zinc-400">—</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                const day = days.find((d) => d.id === item.trainingDayId);
                if (!day) return null;
                const inputs = dailyPctInputs[day.id] ?? pctInputsFrom(null);
                const parsed = parsePctInputs(inputs);
                const best = snapshot
                  ? {
                      tdBest: snapshot.tdBest,
                      hsrBest: snapshot.hsrBest,
                      sprintBest: snapshot.sprintBest,
                      accBest: snapshot.accBest,
                      decBest: snapshot.decBest,
                    }
                  : null;
                const planned =
                  parsed && best
                    ? calculatePlannedAbsolutes(best, parsed)
                    : null;
                const hasRow = Boolean(dailyByDayId[day.id]);
                return (
                  <div
                    key={day.id}
                    className="w-[260px] shrink-0 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                      Training
                    </p>
                    <p className="font-medium text-white">{day.mdTag}</p>
                    <p className="text-xs text-zinc-500">{day.date}</p>
                    <div className="mt-3 space-y-2">
                      {METRIC_KEYS.map((key) => {
                        const unit = formatMetricUnit(key);
                        const abs =
                          planned == null
                            ? null
                            : key === "td"
                              ? planned.totalDistance
                              : key === "hsr"
                                ? planned.hsr
                                : key === "sprint"
                                  ? planned.sprint
                                  : key === "acc"
                                    ? planned.accelerations
                                    : planned.decelerations;
                        return (
                          <div key={key}>
                            <label className="text-xs text-zinc-500">
                              {METRIC_LABEL[key]} %
                            </label>
                            <input
                              inputMode="decimal"
                              value={inputs[key]}
                              onChange={(e) =>
                                setDailyPctInputs((prev) => ({
                                  ...prev,
                                  [day.id]: {
                                    ...(prev[day.id] ?? pctInputsFrom(EMPTY_PCT)),
                                    [key]: e.target.value,
                                  },
                                }))
                              }
                              className={inputClass}
                            />
                            <p className="mt-0.5 text-xs text-zinc-500">
                              Planned:{" "}
                              {abs == null
                                ? "—"
                                : `${formatPlannerDisplayAbsolute(abs)} ${unit}`}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => saveDaily(day.id)}
                        disabled={pending}
                        className="min-h-[40px] rounded-lg bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        Save Daily
                      </button>
                        <button
                          type="button"
                          onClick={() => applyDailyToSelected(day.id)}
                          disabled={pending || selectedPlayerIds.length === 0}
                          className="min-h-[40px] rounded-lg border border-emerald-700/50 text-sm text-emerald-200 hover:bg-emerald-950/30 disabled:opacity-40"
                        >
                          Apply to {selectedPlayerIds.length} selected
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedPlayerIds.length === 0) {
                              setError(
                                "Select at least one player before opening Daily Plan."
                              );
                              return;
                            }
                            setError(null);
                            const qs = new URLSearchParams({
                              weekDayId: day.id,
                              playerIds: selectedPlayerIds.join(","),
                            });
                            window.open(
                              `/admin/planner/daily-plan?${qs.toString()}`,
                              "_blank",
                              "noopener,noreferrer"
                            );
                          }}
                          disabled={selectedPlayerIds.length === 0}
                          className="min-h-[40px] rounded-lg border border-zinc-600 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                        >
                          Daily Plan
                        </button>
                        {hasRow && (
                        <button
                          type="button"
                          onClick={() => askDeleteDaily(day.id)}
                          className="min-h-[36px] rounded-lg border border-red-800/50 text-xs text-red-300"
                        >
                          Delete daily
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {dailyApplyOutcomes && (
              <div className="rounded-lg border border-zinc-700/60 p-3">
                <p className="mb-2 text-sm font-medium text-zinc-200">
                  Daily apply outcomes
                  {dailyApplyContext ? (
                    <span className="ml-2 font-normal text-zinc-400">
                      ({dailyApplyContext})
                    </span>
                  ) : null}
                </p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                  {dailyApplyOutcomes.map((o) => {
                    const fmt = formatBulkApplyOutcomeStatus(o.status);
                    return (
                      <li key={o.playerId} className="flex gap-2 text-zinc-300">
                        <span
                          className={
                            fmt.tone === "fail"
                              ? "text-red-400"
                              : "text-emerald-400"
                          }
                        >
                          {fmt.mark} {fmt.label}
                        </span>
                        <span>
                          — {playerById.get(o.playerId)?.name ?? o.playerId}
                        </span>
                        {o.message && (
                          <span className="text-zinc-500">· {o.message}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Progress */}
      <Card title="Weekly progress">
        {!focusedPlayerId || !weeklyTarget ? (
          <p className="text-sm text-zinc-400">
            Focus a player with a Weekly Target, then set Progress through date
            and refresh.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field
                label="Progress through date"
                hint="Weekly Actual and To Target use training days up to this date."
              >
                <input
                  type="date"
                  value={throughDate}
                  min={selectedWeek?.startDate}
                  max={selectedWeek?.endDate}
                  onChange={(e) => setThroughDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <button
                type="button"
                onClick={() => void loadProgress()}
                disabled={progressLoading}
                className="min-h-[44px] rounded-lg border border-zinc-600 px-4 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                {progressLoading ? "Loading…" : "Refresh progress"}
              </button>
            </div>

            {progressLoading && !progress && (
              <p className="text-sm text-zinc-500">Loading Actual from Power BI…</p>
            )}

            {progress && (
              <>
                <CompletenessBanner progress={progress} />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400">
                        <th className="py-2 pr-2 text-left">Metric</th>
                        <th className="py-2 pr-2 text-left">Planned</th>
                        <th className="py-2 pr-2 text-left">
                          Actual{" "}
                          <span className="font-normal text-zinc-500">
                            (Full Training)
                          </span>
                        </th>
                        <th className="py-2 text-left">
                          To Target{" "}
                          <span className="font-normal text-zinc-500">
                            (Planned − Actual)
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["TD", "totalDistance", "m"],
                          ["HSR", "hsr", "m"],
                          ["Sprint", "sprint", "m"],
                          ["Acc", "accelerations", "count"],
                          ["Dec", "decelerations", "count"],
                        ] as const
                      ).map(([label, field, unit]) => {
                        const planned = progress.weeklyPlanned[field];
                        const actual = progress.weeklyActual?.[field];
                        const toTarget = progress.weeklyToTarget?.[field];
                        return (
                          <tr
                            key={field}
                            className="border-b border-zinc-800/50"
                          >
                            <td className="py-2 pr-2 text-zinc-200">{label}</td>
                            <td className="py-2 pr-2 text-zinc-200">
                              {formatPlannerDisplayAbsolute(planned)} {unit}
                            </td>
                            <td className="py-2 pr-2 text-zinc-200">
                              {progress.weeklyActual == null ||
                              actual == null
                                ? "—"
                                : `${formatPlannerDisplayAbsolute(actual)} ${unit}`}
                            </td>
                            <td className="py-2 text-zinc-200">
                              {progress.weeklyToTarget == null ||
                              toTarget == null
                                ? "—"
                                : `${formatPlannerDisplayAbsolute(toTarget)} ${unit}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-zinc-500">
                  To Target = Planned − Actual. Positive = remaining, zero =
                  reached, negative = over target (not judged as good/bad).
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500">
                        <th className="py-1.5 pr-2 text-left">Day</th>
                        <th className="py-1.5 pr-2 text-left">Actual status</th>
                        <th className="py-1.5 text-left">Has daily target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progress.days.map((d) => (
                        <tr key={d.weekDayId} className="border-b border-zinc-900">
                          <td className="py-1.5 pr-2 text-zinc-300">
                            {d.mdTag} · {d.date}
                          </td>
                          <td className="py-1.5 pr-2 text-zinc-400">
                            {formatProgressDayStatus(d.status)}
                          </td>
                          <td className="py-1.5 text-zinc-400">
                            {d.hasDailyTarget ? "yes" : "no"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      <PlayerMappingModal
        open={mappingOpen}
        onClose={() => setMappingOpen(false)}
        players={players}
      />

      <ConfirmDialog
        open={confirm != null}
        title={confirm?.title ?? ""}
        body={confirm?.body ?? ""}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runConfirm()}
        busy={confirmBusy}
      />
    </div>
  );
}

const inputClass =
  "w-full min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-white placeholder:text-zinc-600";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-zinc-500">{hint}</span> : null}
    </label>
  );
}

function CompletenessBanner({
  progress,
}: {
  progress: PlannerWeeklyProgressResult;
}) {
  const { actualCompleteness, foundDays, notFoundDays, includedDays, problematicDays } =
    progress;
  const allNotFound =
    includedDays > 0 && foundDays === 0 && notFoundDays === includedDays;
  const noIncludedDays = includedDays === 0;

  let text: string;
  let cls: string;
  if (noIncludedDays) {
    text =
      "No week days on or before through date — Actual / To Target not available (not treated as 0).";
    cls = "border-zinc-700 bg-zinc-950/50 text-zinc-300";
  } else if (allNotFound) {
    text =
      "No Full Training Actual found for any included day (shown as —; not treated as 0).";
    cls = "border-zinc-700 bg-zinc-950/50 text-zinc-300";
  } else if (actualCompleteness === "complete") {
    text = `Actual complete through date (${foundDays}/${includedDays} days found).`;
    cls = "border-emerald-700/40 bg-emerald-950/20 text-emerald-200";
  } else if (actualCompleteness === "partial_not_found") {
    text = `Incomplete actual data: ${foundDays} found, ${notFoundDays} not found (missing days are not zeroed).`;
    cls = "border-amber-700/40 bg-amber-950/20 text-amber-200";
  } else {
    text = `Incomplete Actual (${problematicDays} problematic day(s): ambiguous/error/incomplete). Weekly Actual not summed as fake zeros.`;
    cls = "border-red-800/40 bg-red-950/20 text-red-200";
  }

  return (
    <p className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>{text}</p>
  );
}
