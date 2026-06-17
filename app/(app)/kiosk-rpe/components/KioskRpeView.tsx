"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Monitor, Users } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { buildKioskSubmitRequest } from "@/lib/kioskRpe/buildSubmitPayload";
import { getKioskSubmissionConfirmationCopy } from "@/lib/kioskRpe/submissionConfirmation";
import {
  DEFAULT_DURATION_MINUTES,
  DEFAULT_GLOBAL_SETTINGS,
  parseDurationInput,
} from "@/lib/kioskRpe/constants";
import {
  applySettingsToAll,
  createInitialDurationInputs,
  createInitialPlayerStates,
  isKioskPlayerCompleted,
  syncAllDurationInputs,
  updatePlayerRpe,
  updatePlayerSettings,
} from "@/lib/kioskRpe/state";
import { submitKioskRpeEntries } from "@/lib/kioskRpe/submitClient";
import type { KioskGlobalSettings, RpeValue } from "@/lib/kioskRpe/types";
import type { KioskPlayer } from "@/lib/players/listPlayers";
import type { SafeError } from "@/lib/supabase/safeQuery";
import { KioskGlobalSettings as KioskGlobalSettingsPanel } from "./KioskGlobalSettings";
import { KioskSummaryBar } from "./KioskSummaryBar";
import { KioskPlayerRow } from "./KioskPlayerRow";
import { KioskSubmitConfirmation } from "./KioskSubmitConfirmation";
import { KioskTodayNotice } from "./KioskTodayNotice";

const CARD_RADIUS = "12px";

type SubmissionStatus = "idle" | "confirming" | "submitting" | "success" | "error";

interface KioskRpeViewProps {
  players: KioskPlayer[];
  loadError: SafeError | null;
  todayKioskBatchCount: number;
  todayKioskBatchCountUnavailable?: boolean;
}

export function KioskRpeView({
  players,
  loadError,
  todayKioskBatchCount,
  todayKioskBatchCountUnavailable = false,
}: KioskRpeViewProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const feedbackRef = useRef<HTMLDivElement>(null);

  const [globalSettings, setGlobalSettings] = useState<KioskGlobalSettings>(DEFAULT_GLOBAL_SETTINGS);
  const [globalDurationInput, setGlobalDurationInput] = useState(String(DEFAULT_DURATION_MINUTES));
  const [playerStates, setPlayerStates] = useState(() => createInitialPlayerStates(players));
  const [durationInputs, setDurationInputs] = useState(() =>
    createInitialDurationInputs(players)
  );
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>("idle");
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
  const [insertedCount, setInsertedCount] = useState<number | null>(null);
  const [knownTodayBatchCount, setKnownTodayBatchCount] = useState(todayKioskBatchCount);
  const [todayBatchCountUnavailable, setTodayBatchCountUnavailable] = useState(
    todayKioskBatchCountUnavailable
  );

  const playerIds = useMemo(() => players.map((p) => p.id), [players]);

  const isReadOnly = submissionStatus === "success";
  const globalDurationInvalid = parseDurationInput(globalDurationInput) === null;
  const hasPlayers = players.length > 0;
  const applyAllDisabled =
    !hasPlayers || globalDurationInvalid || Boolean(loadError) || isReadOnly;

  const handleApplyAll = useCallback(() => {
    const duration = parseDurationInput(globalDurationInput);
    if (duration === null) return;

    const nextGlobal: KioskGlobalSettings = {
      ...globalSettings,
      duration,
    };
    setGlobalSettings(nextGlobal);
    setGlobalDurationInput(String(duration));
    setPlayerStates((prev) => applySettingsToAll(prev, nextGlobal));
    setDurationInputs((prev) => syncAllDurationInputs(playerIds, duration, prev));
  }, [globalDurationInput, globalSettings, playerIds]);

  const handlePlayerSettingsChange = useCallback(
    (
      playerId: string,
      patch: Partial<{
        sessionType: KioskGlobalSettings["sessionType"];
        matchdayTag: KioskGlobalSettings["matchdayTag"];
        duration: number;
      }>
    ) => {
      setPlayerStates((prev) => updatePlayerSettings(prev, playerId, patch));
    },
    []
  );

  const handleDurationInputChange = useCallback((playerId: string, value: string) => {
    setDurationInputs((prev) => ({ ...prev, [playerId]: value }));
    const parsed = parseDurationInput(value);
    if (parsed !== null) {
      setPlayerStates((prev) => updatePlayerSettings(prev, playerId, { duration: parsed }));
    }
  }, []);

  const handleRpeSelect = useCallback((playerId: string, rpe: RpeValue) => {
    setPlayerStates((prev) => updatePlayerRpe(prev, playerId, rpe));
  }, []);

  const total = players.length;
  const completed = useMemo(() => {
    return players.reduce((count, player) => {
      const state = playerStates[player.id];
      const durationInput = durationInputs[player.id] ?? "";
      if (!state) return count;
      return count + (isKioskPlayerCompleted(state, durationInput) ? 1 : 0);
    }, 0);
  }, [players, playerStates, durationInputs]);
  const missing = total - completed;

  const performSubmit = useCallback(async () => {
    const payload = buildKioskSubmitRequest(playerIds, playerStates, durationInputs);
    if (payload.entries.length === 0) return;

    setSubmissionStatus("submitting");
    setSubmissionMessage(null);

    const result = await submitKioskRpeEntries(payload);

    if (result.ok) {
      setSubmissionStatus("success");
      setInsertedCount(result.insertedCount);
      setSubmissionMessage(`${result.insertedCount} RPE entries submitted successfully.`);
      setKnownTodayBatchCount((count) => count + 1);
      setTodayBatchCountUnavailable(false);
      feedbackRef.current?.focus();
      return;
    }

    setSubmissionStatus("error");
    setSubmissionMessage(result.message);
    feedbackRef.current?.focus();
  }, [durationInputs, playerIds, playerStates]);

  const handleSubmitClick = useCallback(() => {
    if (submissionStatus === "submitting" || submissionStatus === "success") return;
    if (completed === 0 || loadError || !hasPlayers) return;

    setSubmissionMessage(null);

    const confirmation = getKioskSubmissionConfirmationCopy({
      completedCount: completed,
      missingCount: missing,
      todayBatchCount: knownTodayBatchCount,
    });

    if (confirmation.required) {
      setSubmissionStatus("confirming");
      return;
    }

    void performSubmit();
  }, [
    completed,
    hasPlayers,
    knownTodayBatchCount,
    loadError,
    missing,
    performSubmit,
    submissionStatus,
  ]);

  const handleConfirmSubmit = useCallback(() => {
    void performSubmit();
  }, [performSubmit]);

  const handleCancelConfirm = useCallback(() => {
    if (submissionStatus === "submitting") return;
    setSubmissionStatus("idle");
  }, [submissionStatus]);

  const submitDisabled =
    completed === 0 ||
    submissionStatus === "submitting" ||
    submissionStatus === "success" ||
    Boolean(loadError) ||
    !hasPlayers;

  const submitButtonLabel =
    submissionStatus === "success"
      ? "Submitted"
      : submissionStatus === "submitting"
        ? "Submitting..."
        : "Submit All";

  const feedbackTone =
    submissionStatus === "success"
      ? "success"
      : submissionStatus === "error"
        ? "error"
        : submissionStatus === "submitting"
          ? "info"
          : "neutral";

  const feedbackText = (() => {
    if (submissionStatus === "submitting") {
      return `Submitting ${completed} ${completed === 1 ? "entry" : "entries"}...`;
    }
    if (submissionStatus === "success" && insertedCount !== null) {
      return `${insertedCount} RPE entries submitted successfully.`;
    }
    if (submissionStatus === "error" && submissionMessage) {
      return submissionMessage;
    }
    if (completed === 0 && hasPlayers && !loadError) {
      return "Select an RPE for at least one player before submitting.";
    }
    if (completed > 0) {
      const readyText = `${completed} ${completed === 1 ? "player" : "players"} ready to submit.`;
      if (missing > 0) {
        return `${readyText} ${missing} ${missing === 1 ? "player is" : "players are"} still missing.`;
      }
      return readyText;
    }
    return `Completed: ${completed} · Missing: ${missing}`;
  })();

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-6">
      <header className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <Monitor className="h-6 w-6 shrink-0 text-emerald-400 sm:h-7 sm:w-7" aria-hidden />
          <h1 className="text-base font-semibold tracking-tight text-white sm:text-lg md:text-xl lg:text-2xl">
            Kiosk RPE
          </h1>
        </div>
        <p className={`text-xs sm:text-sm ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
          Quick post-session RPE collection for the team.
        </p>
      </header>

      <KioskTodayNotice
        todayBatchCount={knownTodayBatchCount}
        countUnavailable={todayBatchCountUnavailable}
      />

      <KioskGlobalSettingsPanel
        settings={globalSettings}
        durationInput={globalDurationInput}
        onSettingsChange={setGlobalSettings}
        onDurationInputChange={setGlobalDurationInput}
        onApplyAll={handleApplyAll}
        durationInvalid={globalDurationInvalid}
        applyAllDisabled={applyAllDisabled}
        readOnly={isReadOnly}
      />

      {loadError ? (
        <div
          className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 sm:p-5"
          style={{ borderRadius: CARD_RADIUS }}
          role="alert"
        >
          <p className="font-medium text-red-400">Unable to load players.</p>
        </div>
      ) : (
        <>
          <KioskSummaryBar total={total} completed={completed} missing={missing} />

          {total === 0 ? (
            <div
              className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800/90 bg-zinc-900/50 px-5 py-10 text-center"
              style={{ borderRadius: CARD_RADIUS }}
            >
              <Users className="h-10 w-10 text-zinc-500" aria-hidden />
              <p className="text-lg font-semibold text-white">No players found.</p>
              <p className="max-w-sm text-sm text-zinc-400">
                Add player profiles before using Kiosk RPE.
              </p>
            </div>
          ) : (
            <section className="space-y-3" aria-label="Players">
              {players.map((player) => {
                const state = playerStates[player.id];
                if (!state) return null;
                const durationInput = durationInputs[player.id] ?? String(state.duration);
                const isCompleted = isKioskPlayerCompleted(state, durationInput);
                return (
                  <KioskPlayerRow
                    key={player.id}
                    playerId={player.id}
                    name={player.name}
                    avatarUrl={player.avatarUrl}
                    rpe={state.rpe}
                    settings={{
                      sessionType: state.sessionType,
                      matchdayTag: state.matchdayTag,
                      duration: state.duration,
                    }}
                    durationInput={durationInput}
                    isCompleted={isCompleted}
                    readOnly={isReadOnly}
                    onDurationInputChange={(value) => handleDurationInputChange(player.id, value)}
                    onSettingsChange={(patch) => handlePlayerSettingsChange(player.id, patch)}
                    onRpeSelect={(rpe) => handleRpeSelect(player.id, rpe)}
                  />
                );
              })}
            </section>
          )}
        </>
      )}

      <div className="space-y-3 pb-2 pt-2">
        <div
          ref={feedbackRef}
          tabIndex={-1}
          aria-live="polite"
          className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            feedbackTone === "success"
              ? "border-emerald-800/50 bg-emerald-950/20 text-emerald-300"
              : feedbackTone === "error"
                ? "border-red-900/50 bg-red-950/20 text-red-300"
                : feedbackTone === "info"
                  ? "border-zinc-700 bg-zinc-800/50 text-zinc-300"
                  : "border-zinc-800/80 bg-zinc-900/40 text-zinc-400"
          }`}
        >
          {feedbackTone === "success" && (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
          )}
          {feedbackTone === "error" && (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
          )}
          <p>{feedbackText}</p>
        </div>

        <button
          type="button"
          disabled={submitDisabled}
          onClick={handleSubmitClick}
          className="w-full rounded-xl bg-emerald-600 py-4 text-lg font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderRadius: CARD_RADIUS }}
          aria-disabled={submitDisabled}
        >
          {submitButtonLabel}
        </button>
      </div>

      <KioskSubmitConfirmation
        open={submissionStatus === "confirming"}
        completedCount={completed}
        missingCount={missing}
        todayBatchCount={knownTodayBatchCount}
        isSubmitting={submissionStatus === "submitting"}
        onCancel={handleCancelConfirm}
        onConfirm={handleConfirmSubmit}
      />
    </div>
  );
}
