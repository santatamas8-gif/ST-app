"use client";

import type { KioskPlayer } from "@/lib/players/listPlayers";
import { KioskPlayerAvatar } from "./KioskPlayerAvatar";

const CARD_RADIUS = "12px";

type KioskWellnessPlayerHeaderProps = {
  player: KioskPlayer;
  compact?: boolean;
};

export function KioskWellnessPlayerHeader({ player, compact = false }: KioskWellnessPlayerHeaderProps) {
  return (
    <div
      className={`flex flex-col items-center text-center ${
        compact ? "gap-2.5 py-3" : "gap-3 py-4"
      }`}
    >
      <KioskPlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size="gate" />
      <p className={`font-semibold text-white ${compact ? "text-lg" : "text-xl min-[430px]:text-2xl"}`}>
        {player.name}
      </p>
    </div>
  );
}

export function KioskWellnessPlayerHeaderCard({ player }: { player: KioskPlayer }) {
  return (
    <div
      className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4"
      style={{ borderRadius: CARD_RADIUS }}
    >
      <KioskWellnessPlayerHeader player={player} />
    </div>
  );
}
