"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Monitor, Users } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
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
import type { KioskGlobalSettings, RpeValue } from "@/lib/kioskRpe/types";
import type { KioskPlayer } from "@/lib/players/listPlayers";
import type { SafeError } from "@/lib/supabase/safeQuery";
import { KioskGlobalSettings as KioskGlobalSettingsPanel } from "./KioskGlobalSettings";
import { KioskSummaryBar } from "./KioskSummaryBar";
import { KioskPlayerRow } from "./KioskPlayerRow";

const CARD_RADIUS = "12px";

interface KioskRpeViewProps {
  players: KioskPlayer[];
  loadError: SafeError | null;
}

export function KioskRpeView({ players, loadError }: KioskRpeViewProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";

  const [globalSettings, setGlobalSettings] = useState<KioskGlobalSettings>(DEFAULT_GLOBAL_SETTINGS);
  const [globalDurationInput, setGlobalDurationInput] = useState(String(DEFAULT_DURATION_MINUTES));
  const [playerStates, setPlayerStates] = useState(() => createInitialPlayerStates(players));
  const [durationInputs, setDurationInputs] = useState(() =>
    createInitialDurationInputs(players)
  );

  const playerIdsKey = useMemo(() => players.map((p) => p.id).join("|"), [players]);

  useEffect(() => {
    setPlayerStates((prev) => createInitialPlayerStates(players, prev));
    setDurationInputs((prev) => createInitialDurationInputs(players, prev));
  }, [playerIdsKey, players]);

  const globalDurationInvalid = parseDurationInput(globalDurationInput) === null;
  const hasPlayers = players.length > 0;
  const applyAllDisabled = !hasPlayers || globalDurationInvalid || Boolean(loadError);

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
    setDurationInputs((prev) =>
      syncAllDurationInputs(
        players.map((p) => p.id),
        duration,
        prev
      )
    );
  }, [globalDurationInput, globalSettings, players]);

  const handlePlayerSettingsChange = useCallback(
    (
      playerId: string,
      patch: Partial<{ sessionType: KioskGlobalSettings["sessionType"]; matchdayTag: KioskGlobalSettings["matchdayTag"]; duration: number }>
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

      <KioskGlobalSettingsPanel
        settings={globalSettings}
        durationInput={globalDurationInput}
        onSettingsChange={setGlobalSettings}
        onDurationInputChange={setGlobalDurationInput}
        onApplyAll={handleApplyAll}
        durationInvalid={globalDurationInvalid}
        applyAllDisabled={applyAllDisabled}
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

      <div className="space-y-2 pb-2 pt-2">
        <button
          type="button"
          disabled
          title="Saving will be added in the next phase."
          className="w-full rounded-xl bg-emerald-600 py-4 text-lg font-semibold text-white opacity-50 transition disabled:cursor-not-allowed"
          style={{ borderRadius: CARD_RADIUS }}
          aria-disabled="true"
        >
          Submit All
        </button>
        <p className={`text-center text-xs ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>
          Saving will be added in the next phase.
        </p>
      </div>
    </div>
  );
}
