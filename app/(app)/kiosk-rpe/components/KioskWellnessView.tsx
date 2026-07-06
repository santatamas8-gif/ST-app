"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, Users } from "lucide-react";
import { DailyWellnessForm } from "@/components/DailyWellnessForm";
import { submitKioskWellnessEntry } from "@/lib/kioskWellness/submitClient";
import type { KioskWellnessBodyParts } from "@/lib/kioskWellness/submitValidation";
import type { KioskPlayer } from "@/lib/players/listPlayers";
import type { WellnessSubmittedMap } from "@/lib/kioskWellness/todaySubmissions.server";
import type { SafeError } from "@/lib/supabase/safeQuery";
import { KioskInitialsGate } from "./KioskInitialsGate";
import { KioskWellnessPlayerHeaderCard } from "./KioskWellnessPlayerHeader";
import { KioskWellnessPlayerCard } from "./KioskWellnessPlayerCard";

const CARD_RADIUS = "12px";

type WellnessStep = "grid" | "gate" | "form";

type KioskWellnessViewProps = {
  players: KioskPlayer[];
  loadError: SafeError | null;
  wellnessSubmittedToday: WellnessSubmittedMap;
  sessionDate: string;
};

export function KioskWellnessView({
  players,
  loadError,
  wellnessSubmittedToday: initialSubmitted,
  sessionDate,
}: KioskWellnessViewProps) {
  const [step, setStep] = useState<WellnessStep>("grid");
  const [selectedPlayer, setSelectedPlayer] = useState<KioskPlayer | null>(null);
  const [verifiedInitials, setVerifiedInitials] = useState("");
  const [submittedMap, setSubmittedMap] = useState<WellnessSubmittedMap>(initialSubmitted);

  const submittedCount = useMemo(
    () => players.filter((player) => submittedMap[player.id]).length,
    [players, submittedMap]
  );

  const resetToGrid = useCallback(() => {
    setStep("grid");
    setSelectedPlayer(null);
    setVerifiedInitials("");
  }, []);

  const handleSelectPlayer = useCallback((player: KioskPlayer) => {
    setSelectedPlayer(player);
    setVerifiedInitials("");
    if (submittedMap[player.id]) {
      setStep("form");
      return;
    }
    setStep("gate");
  }, [submittedMap]);

  const handleVerified = useCallback((initials: string) => {
    setVerifiedInitials(initials);
    setStep("form");
  }, []);

  const selectedHasSubmitted = selectedPlayer ? Boolean(submittedMap[selectedPlayer.id]) : false;

  const kioskSubmit = useCallback(
    async (data: {
      sleep_quality: number;
      fatigue: number;
      soreness: number;
      stress: number;
      mood: number;
      illness?: boolean;
      bed_time?: string;
      wake_time?: string;
      body_parts?: KioskWellnessBodyParts;
    }) => {
      if (!selectedPlayer) {
        return { error: "No player selected." };
      }

      if (!verifiedInitials.trim()) {
        return { error: "Player verification required." };
      }

      const result = await submitKioskWellnessEntry({
        date: sessionDate,
        entry: {
          playerId: selectedPlayer.id,
          initials: verifiedInitials,
          ...data,
        },
      });

      if (!result.ok) {
        return { error: result.message };
      }

      setSubmittedMap((prev) => ({ ...prev, [selectedPlayer.id]: true }));
      return { success: true as const };
    },
    [selectedPlayer, sessionDate, verifiedInitials]
  );

  if (loadError) {
    return (
      <div
        className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 sm:p-5"
        style={{ borderRadius: CARD_RADIUS }}
        role="alert"
      >
        <p className="font-medium text-red-400">Unable to load players.</p>
      </div>
    );
  }

  if (step === "gate" && selectedPlayer) {
    return (
      <KioskInitialsGate
        player={selectedPlayer}
        onVerified={handleVerified}
        onCancel={resetToGrid}
      />
    );
  }

  if (step === "form" && selectedPlayer) {
    return (
      <div className="kiosk-wellness-form w-full space-y-4">
        <button
          type="button"
          onClick={resetToGrid}
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to players
        </button>

        <KioskWellnessPlayerHeaderCard player={selectedPlayer} />

        <DailyWellnessForm
          hasSubmittedToday={selectedHasSubmitted}
          kioskMode={{
            playerName: selectedPlayer.name,
            onBack: resetToGrid,
            submitWellness: kioskSubmit,
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3 text-sm"
        style={{ borderRadius: CARD_RADIUS }}
      >
        <span className="text-zinc-400">
          {submittedCount} of {players.length} submitted today
        </span>
      </div>

      {players.length === 0 ? (
        <div
          className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800/90 bg-zinc-900/50 px-5 py-10 text-center"
          style={{ borderRadius: CARD_RADIUS }}
        >
          <Users className="h-10 w-10 text-zinc-500" aria-hidden />
          <p className="text-lg font-semibold text-white">No players found.</p>
          <p className="max-w-sm text-sm text-zinc-400">
            Add player profiles before using Kiosk Wellness.
          </p>
        </div>
      ) : (
        <section
          className="grid grid-cols-2 auto-rows-[10rem] gap-3 min-[430px]:auto-rows-[11rem] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:gap-4"
          aria-label="Players"
        >
          {players.map((player) => (
            <KioskWellnessPlayerCard
              key={player.id}
              player={player}
              hasSubmittedToday={Boolean(submittedMap[player.id])}
              onSelect={() => handleSelectPlayer(player)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
