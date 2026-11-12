"use client";

import { Pencil, Plus, StickyNote } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { TrainingPlanner, type PlannerDraft, type PlannerDraftItem } from "@/app/(app)/drill-analysis/TrainingPlanner";
import { filterHistoryEntries, type HistoryEntry } from "@/lib/drillAnalysis/historySearch";
import { formatSessionDate } from "@/lib/drillAnalysis/format";
import type { PlanItemSnapshot } from "@/lib/drillAnalysis/trainingPlan";
import type { DrillMetricKey } from "@/lib/drillAnalysis/types";

const PAGE_SIZE = 24;
const CARD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type HistoryDetail = {
  id: string;
  title: string;
  date: string;
  sessionLabel: string;
  hasImage: boolean;
  sets: { label: string; duration: string | null }[];
  metrics: { key: DrillMetricKey; label: string; values: string[] }[];
  note?: string;
};

function imageUrl(id: string, hasImage: boolean): string | null {
  if (!hasImage || !CARD_ID.test(id)) return null;
  return `/api/drill-analysis/image?cardId=${encodeURIComponent(id)}`;
}

function setLabel(count: number): string {
  return `${count} ${count === 1 ? "set" : "sets"}`;
}

export function DrillHistory() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [layoutNote, setLayoutNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<PlannerDraft | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedPlans, setSavedPlans] = useState<SavedPlanSummary[] | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function ensureDraft(): PlannerDraft {
    return draft ?? emptyDraft();
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [appliedQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetch("/api/drill-analysis/history");
        const body = (await response.json().catch(() => null)) as
          | { entries?: HistoryEntry[]; layoutNote?: string | null; error?: string }
          | null;
        if (cancelled) return;
        if (!response.ok || !body || !Array.isArray(body.entries)) {
          setEntries(null);
          setError(body?.error || "Drill history could not be loaded.");
          return;
        }
        setEntries(body.entries);
        setLayoutNote(body.layoutNote ?? null);
      } catch {
        if (!cancelled) setError("Drill history could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    void (async () => {
      try {
        const response = await fetch("/api/drill-analysis/history/detail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionKey: selected.sessionKey, cardId: selected.id }),
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => null)) as (HistoryDetail & { error?: string }) | null;
        if (!response.ok || !body || !Array.isArray(body.metrics)) {
          setDetailError(body?.error || "Drill details could not be loaded.");
          return;
        }
        setDetail(body);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDetailError("Drill details could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    })();
    return () => controller.abort();
  }, [selected]);

  async function addToPlan(entry: HistoryEntry) {
    const current = ensureDraft();
    if (current.items.some((item) => item.sourceSessionKey === entry.sessionKey && item.sourceEntryId === entry.id)) {
      setNotice("This drill is already in the plan.");
      setPlannerOpen(true);
      return;
    }
    setAddingId(`${entry.sessionKey}:${entry.id}`);
    setNotice(null);
    setSaveError(null);
    try {
      const response = await fetch("/api/drill-analysis/plans/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey: entry.sessionKey, cardId: entry.id }),
      });
      const body = (await response.json().catch(() => null)) as { snapshot?: PlanItemSnapshot; hasImage?: boolean; error?: string } | null;
      if (!response.ok || !body?.snapshot) {
        setNotice(body?.error || "This drill could not be added.");
        return;
      }
      const item: PlannerDraftItem = {
        sourceSessionKey: entry.sessionKey,
        sourceEntryId: entry.id,
        snapshot: body.snapshot,
        hasImage: Boolean(body.hasImage),
        savedItemId: null,
      };
      setDraft((previous) => {
        const base = previous ?? current;
        if (base.items.some((existing) => existing.sourceSessionKey === entry.sessionKey && existing.sourceEntryId === entry.id)) {
          return base;
        }
        return { ...base, items: [...base.items, item], clean: false };
      });
      setPlannerOpen(true);
    } catch {
      setNotice("This drill could not be added.");
    } finally {
      setAddingId(null);
    }
  }

  async function savePlan() {
    if (!draft) return;
    setSavingPlan(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/drill-analysis/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          name: draft.name,
          planDate: draft.planDate,
          notes: draft.notes,
          items: draft.items.map((item) => ({
            sourceSessionKey: item.sourceSessionKey,
            sourceEntryId: item.sourceEntryId,
          })),
        }),
      });
      const body = (await response.json().catch(() => null)) as (SavedPlanRecord & { error?: string }) | null;
      if (!response.ok || !body || !Array.isArray(body.items)) {
        setSaveError(body?.error || "The plan could not be saved.");
        return;
      }
      setDraft(draftFromRecord(body));
      setSavedPlans(null);
    } catch {
      setSaveError("The plan could not be saved.");
    } finally {
      setSavingPlan(false);
    }
  }

  async function loadSavedPlans() {
    setSavedOpen(true);
    setPlansError(null);
    try {
      const response = await fetch("/api/drill-analysis/plans");
      const body = (await response.json().catch(() => null)) as { plans?: SavedPlanSummary[]; error?: string } | null;
      if (!response.ok || !body || !Array.isArray(body.plans)) {
        setPlansError(body?.error || "Saved plans could not be loaded.");
        return;
      }
      setSavedPlans(body.plans);
    } catch {
      setPlansError("Saved plans could not be loaded.");
    }
  }

  async function openSavedPlan(id: string) {
    setPlansError(null);
    try {
      const response = await fetch(`/api/drill-analysis/plans?id=${encodeURIComponent(id)}`);
      const body = (await response.json().catch(() => null)) as (SavedPlanRecord & { error?: string }) | null;
      if (!response.ok || !body || !Array.isArray(body.items)) {
        setPlansError(body?.error || "The plan could not be opened.");
        return;
      }
      setDraft(draftFromRecord(body));
      setPlannerOpen(true);
      setSaveError(null);
      setNotice(null);
    } catch {
      setPlansError("The plan could not be opened.");
    }
  }

  function printPlan() {
    const sheet = document.querySelector(".da-sheet");
    sheet?.classList.add("da-plan-printing");
    const cleanup = () => sheet?.classList.remove("da-plan-printing");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1000);
  }

  const matches = useMemo(
    () => filterHistoryEntries(entries ?? [], appliedQuery),
    [entries, appliedQuery]
  );
  const visible = matches.slice(0, shown);

  const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setToolbarSlot(document.getElementById("da-plan-toolbar-slot"));
  }, []);
  useEffect(() => {
    const sheet = document.querySelector(".da-sheet");
    if (!sheet) return;
    sheet.classList.toggle("da-planner-open", plannerOpen);
    sheet.classList.toggle("da-saved-open", savedOpen && !plannerOpen);
    return () => {
      sheet.classList.remove("da-planner-open", "da-saved-open");
    };
  }, [plannerOpen, savedOpen]);

  const toolbar = (
    <>
      <button
        type="button"
        className={`h-11 shrink-0 rounded-lg px-4 text-base font-medium ${plannerOpen ? "bg-[#11243B] text-white" : "border border-zinc-300 bg-white text-zinc-900"}`}
        onClick={() => {
          setDraft((current) => current ?? emptyDraft());
          setPlannerOpen((open) => !open);
        }}
      >
        Training Planner
      </button>
      <button
        type="button"
        className={`h-11 shrink-0 rounded-lg px-4 text-base font-medium ${savedOpen && !plannerOpen ? "bg-[#11243B] text-white" : "border border-zinc-300 bg-white text-zinc-900"}`}
        onClick={() => void loadSavedPlans()}
      >
        Saved plans
      </button>
    </>
  );

  return (
    <div className="da-plan-stack space-y-4">
      <style>{`
        @media screen {
          .da-sheet:not(.da-tab-history) #da-plan-toolbar-slot { display: none; }
          .da-sheet.da-planner-open .da-history-tabs [data-da-tab="history"],
          .da-sheet.da-saved-open .da-history-tabs [data-da-tab="history"] {
            background-color: #fff;
            color: #18181b;
            border: 1px solid #d4d4d8;
          }
          .da-sheet .da-plan-stack.space-y-4 > .da-plan-editor { margin-top: 0; }
        }
      `}</style>
      <style>{PLAN_PRINT_CSS}</style>
      {toolbarSlot ? createPortal(toolbar, toolbarSlot) : null}
      {plannerOpen && draft ? (
        <TrainingPlanner
          draft={draft}
          saving={savingPlan}
          error={saveError}
          onChange={setDraft}
          onSave={() => void savePlan()}
          onPrint={printPlan}
        />
      ) : null}
      {savedOpen ? (
        <div className="da-history-browser space-y-2 rounded-xl border border-[#d5dee6] bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#11243B]">Saved plans</h2>
            <button type="button" className="h-11 rounded-lg border border-zinc-300 px-3 text-sm font-medium" onClick={() => setSavedOpen(false)}>
              Close
            </button>
          </div>
          {plansError ? <p className="text-sm text-zinc-800">{plansError}</p> : null}
          {savedPlans && savedPlans.length === 0 ? <p className="text-sm text-zinc-700">No saved plans yet.</p> : null}
          <ul className="space-y-2">
            {(savedPlans ?? []).map((plan) => (
              <li key={plan.id}>
                <button
                  type="button"
                  className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-left"
                  onClick={() => void openSavedPlan(plan.id)}
                >
                  <span className="font-semibold text-[#11243B]">{plan.name}</span>
                  <span className="text-sm text-zinc-600">
                    {formatSessionDate(plan.planDate)} · {plan.itemCount} {plan.itemCount === 1 ? "drill" : "drills"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="da-history-browser space-y-4">
      <label className="block text-sm">
        <span className="sr-only">Search drills</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search drills…"
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900"
        />
      </label>
      {layoutNote ? <p className="text-sm text-zinc-700">{layoutNote}</p> : null}
      {loading ? <p className="text-sm text-zinc-700">Loading drill history…</p> : null}
      {error ? (
        <div className="space-y-2">
          <p className="text-sm text-zinc-800">{error}</p>
          <button
            type="button"
            className="h-11 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      ) : null}
      {!loading && !error && entries && matches.length === 0 ? (
        <p className="text-sm text-zinc-700">
          {entries.length === 0 ? "No drills are available." : "No drills match this search."}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-zinc-800">{notice}</p> : null}
      {visible.length > 0 ? (
        <p className="text-sm text-zinc-600">
          Showing {visible.length} of {matches.length}
        </p>
      ) : null}
      <div className="grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4">
        {visible.map((entry) => {
          const key = `${entry.sessionKey}:${entry.id}`;
          const inPlan = Boolean(draft?.items.some((item) => item.sourceSessionKey === entry.sessionKey && item.sourceEntryId === entry.id));
          return (
            <HistoryCard
              key={key}
              entry={entry}
              inPlan={inPlan}
              adding={addingId === key}
              onOpen={() => setSelected(entry)}
              onAdd={() => void addToPlan(entry)}
            />
          );
        })}
      </div>
      {matches.length > shown ? (
        <button
          type="button"
          className="h-11 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900"
          onClick={() => setShown((count) => count + PAGE_SIZE)}
        >
          Load more
        </button>
      ) : null}
      {selected ? (
        <HistoryDetailDialog
          entry={selected}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={() => setSelected(null)}
        />
      ) : null}
      </div>
    </div>
  );
}

function HistoryCard({
  entry,
  inPlan,
  adding,
  onOpen,
  onAdd,
}: {
  entry: HistoryEntry;
  inPlan: boolean;
  adding: boolean;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const src = imageUrl(entry.id, entry.hasImage);
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative flex h-full min-h-11 flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white text-left">
      <button type="button" onClick={onOpen} className="flex min-h-11 flex-1 flex-col text-left">
      <span className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-[#c6edb8]">
        {src && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-contain"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-sm text-zinc-600">No image</span>
        )}
      </span>
      <span className="flex flex-col gap-0.5 px-2.5 py-2 pr-12">
        <span className="truncate text-sm font-semibold leading-5 text-[#11243B]">{entry.title}</span>
        <span className="mt-2.5 truncate text-xs leading-4 text-zinc-500">
          {formatSessionDate(entry.date)} · {entry.sessionLabel}
        </span>
        <span className="truncate text-xs leading-4 text-zinc-600">
          {[setLabel(entry.setCount), entry.duration].filter(Boolean).join(" · ")}
        </span>
      </span>
      </button>
      <button
        type="button"
        onClick={onAdd}
        disabled={inPlan || adding}
        aria-label={inPlan ? "In plan" : "Add to plan"}
        className={`absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm ${inPlan ? "border-[#0f766e] bg-[#0f766e] text-white" : "border-zinc-300 bg-white text-[#11243B]"} disabled:opacity-70`}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function HistoryDetailDialog({
  entry,
  detail,
  loading,
  error,
  onClose,
}: {
  entry: HistoryEntry;
  detail: HistoryDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const src = imageUrl(detail?.id ?? entry.id, Boolean(detail?.hasImage ?? entry.hasImage));
  const [failed, setFailed] = useState(false);
  const title = detail?.title || entry.title;
  const date = detail?.date || entry.date;
  const sessionLabel = detail?.sessionLabel || entry.sessionLabel;
  const severalSets = (detail?.sets.length ?? 0) > 1;
  const singleDuration = detail?.sets.length === 1 ? detail.sets[0]?.duration : null;
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-zinc-900/50 p-3 sm:p-6" role="dialog" aria-modal="true">
      <div className="mx-auto w-full max-w-5xl rounded-xl bg-white p-4 shadow-lg sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-3xl font-semibold leading-tight text-[#11243B]">{title}</h2>
            <p className="mt-1 text-xs text-zinc-400">
              {formatSessionDate(date)} · {sessionLabel}
              {singleDuration ? ` · ${singleDuration}` : ""}
              {" · Team average"}
            </p>
          </div>
          <button
            type="button"
            className="h-11 shrink-0 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-900"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start">
          <div className="w-full md:w-1/2 md:shrink-0">
            {src && !failed ? (
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-[#c6edb8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-contain"
                  onError={() => setFailed(true)}
                />
              </div>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-zinc-100 text-sm text-zinc-500">
                No image
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {loading ? <p className="text-sm text-zinc-500">Loading team values…</p> : null}
            {error ? <p className="text-sm text-zinc-800">{error}</p> : null}
            {detail ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  {severalSets ? (
                    <thead>
                      <tr className="border-b border-zinc-200">
                        <th className="w-16 py-1.5 pr-3" />
                        {detail.sets.map((set, index) => (
                          <th key={`${set.label}-${index}`} className="px-2 py-1.5 text-right">
                            <span className="block text-sm font-medium text-zinc-500">
                              {index + 1}. {set.label}
                            </span>
                            {set.duration ? (
                              <span className="mt-0.5 block text-xs text-zinc-400">{set.duration}</span>
                            ) : null}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  ) : null}
                  <tbody>
                    {detail.metrics.map((metric) => (
                      <tr key={metric.key} className="border-b border-zinc-100">
                        <th className="whitespace-nowrap py-2.5 pr-4 text-base font-medium text-zinc-600">{metric.label}</th>
                        {metric.values.map((value, index) => (
                          <td
                            key={`${metric.key}-${index}`}
                            className="py-2.5 text-right text-lg font-semibold tabular-nums text-zinc-900"
                          >
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
        {detail ? (
          <HistoryNoteEditor sessionKey={entry.sessionKey} entryId={entry.id} savedNote={detail.note ?? ""} />
        ) : null}
      </div>
    </div>
  );
}

function HistoryNoteEditor({
  sessionKey,
  entryId,
  savedNote,
}: {
  sessionKey: string;
  entryId: string;
  savedNote: string;
}) {
  const [draft, setDraft] = useState(savedNote);
  const [stored, setStored] = useState(savedNote);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(savedNote);
    setStored(savedNote);
    setEditing(false);
    setSaved(false);
    setError(null);
  }, [sessionKey, entryId, savedNote]);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await fetch("/api/drill-analysis/history/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey, cardId: entryId, note: draft }),
      });
      const body = (await response.json().catch(() => null)) as { note?: string; error?: string } | null;
      if (!response.ok || !body || typeof body.note !== "string") {
        setError(body?.error || "The note could not be saved.");
        return;
      }
      setDraft(body.note);
      setStored(body.note);
      setEditing(false);
      setSaved(true);
    } catch {
      setError("The note could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing && !stored.trim()) {
    return (
      <div className="mt-3">
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-800"
          onClick={() => setEditing(true)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add note
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <StickyNote className="h-3.5 w-3.5 shrink-0 text-[#11243B]" aria-hidden />
        <h3 className="text-xs font-semibold text-[#11243B]">Note</h3>
        {stored.trim() && !editing ? (
          <button
            type="button"
            aria-label="Edit note"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-white"
            onClick={() => {
              setDraft(stored);
              setEditing(true);
              setSaved(false);
            }}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      {stored.trim() && !editing ? (
        <p className="mt-1 whitespace-pre-wrap text-xs leading-4 text-zinc-700">{stored}</p>
      ) : (
        <>
          <textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setSaved(false);
            }}
            rows={2}
            maxLength={2000}
            placeholder="Write extra information for this drill…"
            className="mt-1.5 w-full resize-y rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="h-8 rounded-md bg-[#11243B] px-2.5 text-xs font-medium text-white disabled:opacity-60"
              onClick={() => void save()}
              disabled={saving || draft.trim() === stored.trim()}
            >
              {saving ? "Saving…" : "Save note"}
            </button>
            <button
              type="button"
              className="h-8 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-900"
              onClick={() => {
                setDraft(stored);
                setEditing(false);
                setSaved(false);
                setError(null);
              }}
            >
              Cancel
            </button>
            {saved ? <span className="text-xs text-zinc-500">Saved</span> : null}
            {error ? <span className="text-xs text-zinc-800">{error}</span> : null}
          </div>
        </>
      )}
    </div>
  );
}

type SavedPlanSummary = {
  id: string;
  name: string;
  planDate: string;
  updatedAt: string;
  itemCount: number;
};

type SavedPlanRecord = {
  id: string;
  name: string;
  planDate: string;
  notes: string;
  items: { id: string; hasImage: boolean; snapshot: PlanItemSnapshot }[];
};

function emptyDraft(): PlannerDraft {
  return {
    id: null,
    name: "",
    planDate: new Date().toISOString().slice(0, 10),
    notes: "",
    items: [],
    clean: false,
  };
}

function draftFromRecord(plan: SavedPlanRecord): PlannerDraft {
  return {
    id: plan.id,
    name: plan.name,
    planDate: plan.planDate,
    notes: plan.notes ?? "",
    items: plan.items.map((item) => ({
      sourceSessionKey: item.snapshot.sourceSessionKey,
      sourceEntryId: item.snapshot.sourceEntryId,
      snapshot: item.snapshot,
      hasImage: item.hasImage,
      savedItemId: item.id,
    })),
    clean: true,
  };
}

const PLAN_PRINT_CSS = `
@media print {
  .da-sheet.da-plan-printing {
    display: block !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
  .da-sheet.da-plan-printing .da-daily-panel,
  .da-sheet.da-plan-printing .da-print-footer,
  .da-sheet.da-plan-printing .da-history-tabs,
  .da-sheet.da-plan-printing .da-history-browser {
    display: none !important;
  }
  .da-sheet.da-plan-printing .da-history-panel,
  .da-sheet.da-plan-printing .da-plan-sheet {
    display: block !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
  .da-sheet.da-plan-printing .da-plan-sheet header {
    display: block !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 0 3mm !important;
    padding: 0 0 2mm !important;
    border: 0 !important;
    border-bottom: 0.4mm solid #0f766e !important;
    text-align: left !important;
    background: #ffffff !important;
  }
  .da-sheet.da-plan-printing .da-plan-sheet header h2 {
    display: block !important;
    margin: 0 !important;
    font-size: 16pt !important;
    font-weight: 700 !important;
    line-height: 1.15 !important;
    text-align: left !important;
    color: #11243B !important;
  }
  .da-sheet.da-plan-printing .da-plan-sheet header p {
    display: block !important;
    margin: 1mm 0 0 !important;
    font-size: 10pt !important;
    font-weight: 500 !important;
    line-height: 1.25 !important;
    text-align: left !important;
    color: #1e3a4c !important;
  }
  .da-sheet.da-plan-printing .da-plan-card {
    display: block !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    break-inside: auto;
    page-break-inside: auto;
    margin: 0 0 4mm !important;
    background: #ffffff !important;
  }
  .da-sheet.da-plan-printing .da-plan-band,
  .da-sheet.da-plan-printing .da-plan-band * {
    background: #e7eef3 !important;
    color: #11243B !important;
  }
  .da-sheet.da-plan-printing .da-plan-card table {
    display: table !important;
    width: 100% !important;
    height: auto !important;
    min-width: 0 !important;
    table-layout: auto !important;
    background: #ffffff !important;
  }
  .da-sheet.da-plan-printing .da-plan-card thead { display: table-header-group !important; }
  .da-sheet.da-plan-printing .da-plan-card tr {
    display: table-row !important;
    height: auto !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .da-sheet.da-plan-printing .da-plan-card th,
  .da-sheet.da-plan-printing .da-plan-card td {
    width: auto !important;
    min-width: 0 !important;
    max-width: none !important;
    height: auto !important;
    overflow: visible !important;
    white-space: normal !important;
    background: #ffffff !important;
    color: #18181b !important;
    font-size: 9pt !important;
    font-weight: 600 !important;
    line-height: 1.2 !important;
    text-align: right !important;
  }
  .da-sheet.da-plan-printing .da-plan-card th {
    font-weight: 500 !important;
    text-align: left !important;
    color: #3f3f46 !important;
  }
  .da-sheet.da-plan-printing .da-plan-card img {
    position: static !important;
    display: block !important;
    width: auto !important;
    height: auto !important;
    max-width: 100% !important;
    max-height: 42mm !important;
    object-fit: contain !important;
    object-position: center center !important;
  }
}
`;
