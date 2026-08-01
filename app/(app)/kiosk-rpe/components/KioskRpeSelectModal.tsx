"use client";

import { useEffect, useId, useRef } from "react";
import { CalendarDays, Clock, X } from "lucide-react";
import {
  getRpeButtonSelectedClasses,
  getRpeIntensityBand,
  getRpeMeaning,
  RPE_VALUES,
} from "@/lib/kioskRpe/constants";
import type { KioskMatchdayTag, KioskSessionType, RpeValue } from "@/lib/kioskRpe/types";
import { KioskPlayerAvatar } from "./KioskPlayerAvatar";

const CARD_RADIUS = "12px";
const FIRST_ROW = RPE_VALUES.slice(0, 5);
const SECOND_ROW = RPE_VALUES.slice(5);

/** Unselected RPE chip styles for white modal — stronger hue steps between bands. */
function getRpeButtonLightBaseClasses(rpe: number): string {
  const band = getRpeIntensityBand(rpe);
  const interactive =
    "cursor-pointer transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600";
  switch (band) {
    case "easy":
      return `${interactive} border-2 border-emerald-500 bg-emerald-100 text-emerald-900`;
    case "moderate":
      return `${interactive} border-2 border-lime-500 bg-lime-100 text-lime-900`;
    case "hard":
      return `${interactive} border-2 border-amber-500 bg-amber-100 text-amber-900`;
    case "very-hard":
      return `${interactive} border-2 border-orange-600 bg-orange-200 text-orange-950`;
    case "extreme":
      return `${interactive} border-2 border-red-600 bg-red-200 text-red-900`;
    case "maximal":
      return `${interactive} border-2 border-red-800 bg-red-300 text-red-950`;
  }
}

type KioskRpeSelectModalProps = {
  open: boolean;
  playerName: string;
  avatarUrl: string | null;
  selectedRpe: number | null;
  sessionType: KioskSessionType;
  matchdayTag: KioskMatchdayTag;
  durationMinutes: number;
  rpeReadOnly?: boolean;
  onClose: () => void;
  onSelectRpe: (rpe: RpeValue) => void;
};

export function KioskRpeSelectModal({
  open,
  playerName,
  avatarUrl,
  selectedRpe,
  sessionType,
  matchdayTag,
  durationMinutes,
  rpeReadOnly = false,
  onClose,
  onSelectRpe,
}: KioskRpeSelectModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92vh] w-full max-w-[90vw] flex-col overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl sm:w-[min(900px,90vw)]"
        style={{ borderRadius: "16px", width: "min(840px, 90vw)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 sm:right-4 sm:top-4"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        {/* Hierarchy: avatar → name → session → divider → RPE */}
        <div className="flex flex-col items-center px-4 pt-5 sm:px-6 sm:pt-6">
          <KioskPlayerAvatar name={playerName} avatarUrl={avatarUrl} size="card" />
          <h2
            id={titleId}
            className="mt-2.5 max-w-full truncate px-10 text-center text-lg font-semibold tracking-tight text-zinc-900 sm:mt-3 sm:text-xl"
          >
            {playerName}
          </h2>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-xs font-medium text-zinc-500 sm:mt-2.5 sm:gap-x-3 sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-3.5 w-3.5 shrink-0 rotate-90 bg-zinc-400 sm:h-4 sm:w-4"
                style={{
                  WebkitMaskImage: "url(/icons/training-soccer.svg)",
                  maskImage: "url(/icons/training-soccer.svg)",
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                }}
                aria-hidden
              />
              <span>{sessionType}</span>
            </span>
            <span className="text-zinc-300" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-zinc-400 sm:h-4 sm:w-4" aria-hidden />
              <span>{matchdayTag}</span>
            </span>
            <span className="text-zinc-300" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-zinc-400 sm:h-4 sm:w-4" aria-hidden />
              <span>{durationMinutes} min</span>
            </span>
          </div>
        </div>

        <div className="mx-4 mt-3 border-t border-zinc-200 sm:mx-6 sm:mt-3.5" aria-hidden />

        <div className="space-y-4 px-4 pb-5 pt-3.5 sm:space-y-5 sm:px-6 sm:pb-6 sm:pt-4">
          <div className="space-y-3 sm:space-y-3.5" role="group" aria-label={`RPE for ${playerName}`}>
            {[FIRST_ROW, SECOND_ROW].map((row, rowIndex) => (
              <div
                key={rowIndex === 0 ? "rpe-row-1" : "rpe-row-2"}
                className="grid grid-cols-5 gap-2 sm:gap-3"
              >
                {row.map((value) => {
                  const selected = selectedRpe === value;
                  const meaning = getRpeMeaning(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={rpeReadOnly}
                      aria-pressed={selected}
                      aria-label={`Set ${playerName} RPE to ${value} — ${meaning}`}
                      onClick={() => onSelectRpe(value)}
                      className={`flex min-h-[5rem] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2.5 text-center transition sm:min-h-[5.75rem] sm:gap-1.5 sm:px-2 sm:py-3.5 disabled:cursor-default disabled:opacity-100 ${
                        selected
                          ? getRpeButtonSelectedClasses(value)
                          : getRpeButtonLightBaseClasses(value)
                      }`}
                      style={{ borderRadius: CARD_RADIUS }}
                    >
                      <span className="text-3xl font-bold leading-none sm:text-4xl">{value}</span>
                      <span className="line-clamp-2 w-full text-[11px] font-semibold leading-tight sm:text-xs">
                        {meaning}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {rpeReadOnly ? (
            <p className="text-center text-sm text-zinc-600">
              This RPE is locked and cannot be changed.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
