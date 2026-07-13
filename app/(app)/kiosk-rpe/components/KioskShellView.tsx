"use client";

import { useState } from "react";
import { Monitor } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import type { ExistingSubmissionMap } from "@/lib/kioskRpe/existingSubmission";
import type { KioskPlayer } from "@/lib/players/listPlayers";
import type { WellnessSubmittedMap } from "@/lib/kioskWellness/todaySubmissions.server";
import type { SafeError } from "@/lib/supabase/safeQuery";
import { KioskModeSwitch, type KioskMode } from "./KioskModeSwitch";
import { KioskRpeView } from "./KioskRpeView";
import { KioskWellnessView } from "./KioskWellnessView";

type KioskShellViewProps = {
  players: KioskPlayer[];
  loadError: SafeError | null;
  todayKioskBatchCount: number;
  todayKioskBatchCountUnavailable?: boolean;
  existingSubmissions?: ExistingSubmissionMap;
  wellnessSubmittedToday?: WellnessSubmittedMap;
  sessionDate: string;
};

export function KioskShellView({
  players,
  loadError,
  todayKioskBatchCount,
  todayKioskBatchCountUnavailable = false,
  existingSubmissions = {},
  wellnessSubmittedToday = {},
  sessionDate,
}: KioskShellViewProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const [mode, setMode] = useState<KioskMode>("rpe");

  const subtitle =
    mode === "rpe"
      ? "Quick post-session RPE collection for the team."
      : "Daily wellness check-in — tap a player and enter their initials.";

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <Monitor className="h-6 w-6 shrink-0 text-emerald-400 sm:h-7 sm:w-7" aria-hidden />
              <h1 className="text-base font-semibold tracking-tight text-white sm:text-lg md:text-xl lg:text-2xl">
                Kiosk
              </h1>
            </div>
            <p className={`text-xs sm:text-sm ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
              {subtitle}
            </p>
          </div>
          <KioskModeSwitch mode={mode} onChange={setMode} />
        </div>
      </header>

      {mode === "rpe" ? (
        <KioskRpeView
          embedded
          players={players}
          loadError={loadError}
          todayKioskBatchCount={todayKioskBatchCount}
          todayKioskBatchCountUnavailable={todayKioskBatchCountUnavailable}
          existingSubmissions={existingSubmissions}
        />
      ) : (
        <KioskWellnessView
          players={players}
          loadError={loadError}
          wellnessSubmittedToday={wellnessSubmittedToday}
          sessionDate={sessionDate}
        />
      )}
    </div>
  );
}
