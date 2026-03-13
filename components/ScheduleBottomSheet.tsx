"use client";

import { useEffect, useState } from "react";
import { Calendar, X } from "lucide-react";
import { MATT_CARD_STYLE } from "@/lib/themes";
import { ScheduleIcon } from "@/components/ScheduleIcon";

const SCHEDULE_ACTIVITY_LABELS: Record<string, string> = {
  arrival: "Arrival",
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  training: "Training",
  gym: "Gym",
  recovery: "Recovery",
  pre_activation: "Pre-activation",
  video_analysis: "Video analysis",
  meeting: "Meeting",
  traveling: "Traveling",
  physio: "Physio",
  medical: "Medical",
  media: "Media",
  rest_off: "Rest/Off",
  match: "Match",
  team_building: "Team building",
  individual: "Individual",
};

export type ScheduleItemForSheet = {
  id: string;
  activity_type: string;
  sort_order: number;
  start_time: string | null;
  end_time: string | null;
  notes?: string | null;
  opponent?: string | null;
  team_a?: string | null;
  team_b?: string | null;
};

function LocationPinIcon({ className, ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const fn = () => setIsMobile(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return isMobile;
}

type ScheduleBottomSheetProps = {
  open: boolean;
  onClose: () => void;
  items: ScheduleItemForSheet[];
  themeId: string;
};

export function ScheduleBottomSheet({ open, onClose, items, themeId }: ScheduleBottomSheetProps) {
  const isHighContrast = themeId === "neon" || themeId === "matt";

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop – fully opaque, covers entire viewport so content underneath is not visible */}
      <div
        className="fixed inset-0 z-[200] min-h-screen min-h-dvh bg-black overflow-hidden"
        style={{ touchAction: "none" }}
        aria-hidden
        onTouchMove={(e) => e.preventDefault()}
        onClick={onClose}
      />
      {/* Sheet panel – white border frame; clearly lighter than backdrop */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[201] flex min-h-[85vh] max-h-[85vh] flex-col overflow-hidden rounded-t-2xl border-2 border-white/30 shadow-2xl sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:min-h-0 sm:max-h-[min(560px,88vh)] sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 25px 50px -12px rgba(0,0,0,0.5)",
          ...(themeId === "neon"
            ? { background: "linear-gradient(135deg, #0c1f1d 0%, #07201a 50%, #041311 100%)" }
            : themeId === "matt"
              ? MATT_CARD_STYLE
              : { backgroundColor: "#18181b" }),
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-sheet-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-white/30 bg-white/[0.06] px-4 py-3">
          <h2 id="schedule-sheet-title" className="flex items-center gap-2 text-lg font-semibold text-white">
            <Calendar className="h-6 w-6 shrink-0 text-white/90 sm:h-7 sm:w-7" aria-hidden />
            Today&apos;s Schedule
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-6 w-6 sm:h-7 sm:w-7" />
          </button>
        </div>
        <div
          className="flex-1 overflow-y-auto overscroll-contain border-t border-white/25 p-4 pb-8 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-zinc-800/50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-500 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400"
          style={{
            paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
            minHeight: 0,
            scrollbarColor: "#71717a transparent",
            ...(themeId === "neon"
              ? { background: "linear-gradient(135deg, #0c1f1d 0%, #07201a 50%, #041311 100%)" }
              : themeId === "matt"
                ? MATT_CARD_STYLE
                : { backgroundColor: "#18181b" }),
          }}
        >
          {items.length === 0 ? (
            <p className={isHighContrast ? "text-white/80" : "text-zinc-400"}>No schedule items today.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((item, idx) => {
                const baseLabel = SCHEDULE_ACTIVITY_LABELS[item.activity_type] ?? item.activity_type;
                const label =
                  item.activity_type === "match" && item.team_a?.trim() && item.team_b?.trim()
                    ? `${item.team_a.trim()} vs. ${item.team_b.trim()}`
                    : item.activity_type === "match" && item.opponent?.trim()
                      ? `${baseLabel} vs. ${item.opponent.trim()}`
                      : baseLabel;
                const timeStr =
                  item.start_time != null
                    ? item.end_time != null
                      ? `${item.start_time} – ${item.end_time}`
                      : item.start_time
                    : "—";
                const notes = item.notes?.trim();
                const isMatch = item.activity_type === "match";

                if (themeId === "neon") {
                  return (
                    <li key={`${item.id}-${idx}`}>
                      <div
                        className="w-full rounded-xl border border-transparent shadow-[var(--card-shadow)]"
                        style={{
                          backgroundImage: isMatch
                            ? "radial-gradient(circle at left, rgba(251, 191, 36, 0.26) 0, transparent 55%), linear-gradient(135deg, #141006, #0a0502)"
                            : "radial-gradient(circle at left, rgba(16, 185, 129, 0.26) 0, transparent 55%), linear-gradient(135deg, #041311, #020617)",
                          boxShadow: isMatch
                            ? "0 0 0 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(251, 191, 36, 0.2), 0 5px 16px rgba(180, 83, 9, 0.08), 0 4px 12px rgba(0,0,0,0.25)"
                            : "0 0 0 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(16, 185, 129, 0.2), 0 5px 16px rgba(6, 95, 70, 0.08), 0 4px 12px rgba(0,0,0,0.25)",
                        }}
                      >
                        <div className="schedule-card-text space-y-1 px-4 py-3">
                          <p className={`tabular-nums font-bold text-sm sm:text-base tracking-[0.03em] ${isMatch ? "text-amber-700" : "text-emerald-300"}`}>
                            {item.start_time}
                            {item.end_time != null ? <span className="inline-block px-1.5">–</span> : null}
                            {item.end_time != null ? item.end_time : null}
                          </p>
                          <p className="flex items-center gap-2 text-sm font-medium text-white">
                            {!isMatch && <ScheduleIcon type={item.activity_type} size={28} className="shrink-0 text-white/90" />}
                            <span>{label}</span>
                          </p>
                          {notes ? (
                            <p className="flex items-center gap-2 text-[11px] text-white/60">
                              <LocationPinIcon className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
                              {notes}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                }
                if (themeId === "matt") {
                  return (
                    <li key={`${item.id}-${idx}`}>
                      <div
                        className="w-full rounded-xl border border-transparent"
                        style={
                          isMatch
                            ? {
                                backgroundImage:
                                  "radial-gradient(circle at left, rgba(251, 191, 36, 0.28) 0, transparent 55%), linear-gradient(135deg, #141006, #0a0802)",
                                boxShadow:
                                  "0 0 0 1px rgba(255,255,255,0.2), 0 0 0 1px rgba(251, 191, 36, 0.2), 0 5px 16px rgba(180, 83, 9, 0.08), 0 4px 12px rgba(0,0,0,0.25)",
                                borderRadius: 12,
                              }
                            : { ...MATT_CARD_STYLE, borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }
                        }
                      >
                        <div className="matt-card-text space-y-1 px-4 py-3">
                          <p className={`tabular-nums font-bold text-sm sm:text-base ${isMatch ? "text-amber-700" : "text-emerald-300"}`}>
                            {timeStr}
                          </p>
                          <p className="flex items-center gap-2 text-sm font-medium text-white">
                            {!isMatch && <ScheduleIcon type={item.activity_type} size={28} className="shrink-0 text-white/90" />}
                            <span>{label}</span>
                          </p>
                          {notes ? (
                            <p className="flex items-center gap-2 text-[11px] text-white/60">
                              <LocationPinIcon className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
                              {notes}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={`${item.id}-${idx}`}>
                    <div
                      className={`w-full rounded-lg border border-zinc-700/80 shadow-[var(--card-shadow)] shadow-lg shadow-black/20 ${
                        isMatch
                          ? "border-l-[6px] border-l-amber-500/70 bg-amber-500/10"
                          : "border-l-4 border-l-emerald-500/60 bg-zinc-800/80"
                      }`}
                    >
                      <div className="px-4 py-3">
                        <p
                          className={`tabular-nums font-bold text-sm sm:text-base ${isMatch ? "text-amber-700" : "text-emerald-300"}`}
                        >
                          {timeStr}
                        </p>
                        <p
                          className={`mt-1 flex items-center gap-2 font-medium text-zinc-300 ${
                            isMatch ? "text-sm" : "text-xs"
                          }`}
                        >
                          {!isMatch && <ScheduleIcon type={item.activity_type} size={28} className="shrink-0" />}
                          <span>{label}</span>
                        </p>
                        {notes ? (
                          <p className="mt-1 flex items-center gap-2 text-[11px] text-zinc-600">
                            <LocationPinIcon className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
                            {notes}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
