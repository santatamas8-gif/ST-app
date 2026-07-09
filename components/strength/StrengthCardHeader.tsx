import type { ReactNode } from "react";
import { PlayerAvatar } from "./PlayerAvatar";
import { StrengthCardLogo } from "./StrengthCardLogo";

interface StrengthCardHeaderProps {
  playerName: string;
  playerAvatarUrl?: string | null;
  teamLogoUrl?: string | null;
  date: string;
  sessionLine: string;
  variant?: "screen" | "print";
  hint?: ReactNode;
}

export function StrengthCardHeader({
  playerName,
  playerAvatarUrl,
  teamLogoUrl,
  date,
  sessionLine,
  variant = "screen",
  hint,
}: StrengthCardHeaderProps) {
  if (variant === "print") {
    return (
      <header className="print-card-header">
        <StrengthCardLogo teamLogoUrl={teamLogoUrl} variant="print" />
        <div className="print-card-header-center">
          <PlayerAvatar
            name={playerName}
            avatarUrl={playerAvatarUrl}
            variant="print"
            shape="rect"
          />
          <div className="print-header-text">
            <h1 className="print-player-name">{playerName}</h1>
            <p className="print-date">{date}</p>
          </div>
        </div>
        <div className="print-card-header-spacer" aria-hidden />
      </header>
    );
  }

  return (
    <header className="border-b border-zinc-700/60 pb-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3">
        <div className="flex justify-start pt-1">
          <StrengthCardLogo teamLogoUrl={teamLogoUrl} variant="screen" />
        </div>
        <div className="flex flex-col items-center text-center">
          <PlayerAvatar
            name={playerName}
            avatarUrl={playerAvatarUrl}
            variant="screen"
            shape="rect"
          />
          <h2 className="mt-3 text-lg font-bold tracking-tight text-white sm:text-xl">{playerName}</h2>
          <p className="mt-1 text-sm text-zinc-400">{date}</p>
          <p className="mt-0.5 text-sm text-zinc-500">{sessionLine}</p>
          {hint ? <div className="mt-2 max-w-sm">{hint}</div> : null}
        </div>
        <div aria-hidden className="hidden sm:block" />
      </div>
    </header>
  );
}

/** Landscape frame fits side-by-side exercise photos without cropping. */
export const STRENGTH_CARD_EXERCISE_IMAGE_CLASS =
  "aspect-[3/2] h-[80px] w-[120px] shrink-0 sm:h-[88px] sm:w-[132px]";
