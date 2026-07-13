"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { verifyPlayerInitials } from "@/lib/kioskWellness/initials";
import type { KioskPlayer } from "@/lib/players/listPlayers";
import { KioskWellnessPlayerHeader } from "./KioskWellnessPlayerHeader";

const CARD_RADIUS = "12px";

type KioskInitialsGateProps = {
  player: KioskPlayer;
  onVerified: (initials: string) => void;
  onCancel: () => void;
};

export function KioskInitialsGate({ player, onVerified, onCancel }: KioskInitialsGateProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);

      if (!verifyPlayerInitials(player.name, value)) {
        setError("Incorrect initials. Try again.");
        return;
      }

      onVerified(value.trim());
    },
    [onVerified, player.name, value]
  );

  return (
    <div
      className="mx-auto w-full max-w-md rounded-xl border border-zinc-800/90 bg-zinc-900/60 p-5 sm:p-6"
      style={{ borderRadius: CARD_RADIUS }}
    >
      <button
        type="button"
        onClick={onCancel}
        className="mb-4 inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to players
      </button>

      <KioskWellnessPlayerHeader player={player} />

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label htmlFor="kiosk-initials" className="sr-only">
          Player initials
        </label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
          <input
            ref={inputRef}
            id="kiosk-initials"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={8}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            className="block min-h-[52px] w-full rounded-xl border border-zinc-700 bg-zinc-800 pl-12 pr-4 text-center text-xl font-semibold uppercase tracking-[0.35em] text-white"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "kiosk-initials-error" : undefined}
          />
        </div>

        {error ? (
          <p id="kiosk-initials-error" className="text-center text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={value.trim().length < 2}
          className="w-full min-h-[48px] rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
