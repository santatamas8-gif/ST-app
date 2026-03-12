"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { Activity } from "lucide-react";
import type { SessionRow } from "@/lib/types";
import { formatMonthDay } from "@/lib/formatDate";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";

const CARD_RADIUS = "12px";

/** RPE text color: 1–4 green, 5–7 yellow, 8+ red. */
function rpeColorStyle(rpe: number): { color: string } {
  if (rpe >= 8) return { color: "#ef4444" };
  if (rpe >= 5) return { color: "#facc15" };
  return { color: "#22c55e" };
}

function getLastNDates(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

interface PlayerLoadBreakdownProps {
  sessions: SessionRow[];
}

export function PlayerLoadBreakdown({ sessions }: PlayerLoadBreakdownProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const [periodDays, setPeriodDays] = useState<7 | 14 | 28>(7);

  const dateRange = useMemo(() => getLastNDates(periodDays), [periodDays]);
  const dateSet = useMemo(() => new Set(dateRange), [dateRange]);

  const sessionsInPeriod = useMemo(() => {
    return sessions
      .filter((s) => dateSet.has(s.date))
      .sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [sessions, dateSet]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showBottomFade, setShowBottomFade] = useState(false);

  const updateFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 2;
    setShowBottomFade(!atBottom);
  }, []);

  useEffect(() => {
    updateFade();
  }, [sessionsInPeriod, updateFade]);

  const cardStyle =
    themeId === "neon"
      ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
      : themeId === "matt"
        ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
        : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS };

  return (
    <div className="space-y-6">
      <div
        className={`rounded-xl p-4 ${isHighContrast ? "neon-card-text" : ""}`}
        style={cardStyle}
      >
        <div className="flex flex-wrap items-center gap-2 border-b pb-3" style={{ borderColor: "var(--card-border)" }}>
          <Activity className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--foreground)" }}>
            Load (duration × RPE)
          </span>
        </div>
        <div className="mt-3 flex justify-center sm:justify-start">
          <div
            className="inline-flex rounded-[14px] border p-0.5 h-10"
            style={{
              backgroundColor: isHighContrast ? "rgba(255,255,255,0.06)" : "rgba(15,23,32,0.9)",
              borderColor: isHighContrast ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)",
            }}
          >
            {([7, 14, 28] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPeriodDays(n)}
                className={`min-w-[72px] flex-1 rounded-[10px] text-sm font-medium transition-all duration-200 ${
                  periodDays === n
                    ? "bg-emerald-700/90 text-white"
                    : "bg-transparent text-gray-400 hover:text-gray-300 hover:bg-white/5 active:bg-white/10"
                }`}
              >
                {n} days
              </button>
            ))}
          </div>
        </div>
        {sessionsInPeriod.length === 0 ? (
          <p className="mt-4 text-sm opacity-70" style={{ color: "var(--foreground)" }}>
            No sessions in this period.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto -mx-1 px-1">
            <div
              className="rounded-[16px] border overflow-hidden min-w-[280px] flex flex-col"
              style={{
                backgroundColor: isHighContrast ? "rgba(255,255,255,0.03)" : "#0d1117",
                borderColor: isHighContrast ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)",
                maxHeight: "412px",
              }}
            >
              <div
                className="grid gap-x-0 gap-y-0 text-xs font-semibold uppercase tracking-wide min-h-[48px] items-center px-4 shrink-0"
                style={{
                  gridTemplateColumns: "1.2fr 1fr 0.6fr 0.8fr",
                  backgroundColor: isHighContrast ? "rgba(255,255,255,0.08)" : "rgba(15,23,32,0.95)",
                  color: isHighContrast ? "rgba(255,255,255,0.95)" : "rgba(226,232,240,0.95)",
                  borderBottom: "1px solid " + (isHighContrast ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.1)"),
                }}
              >
                <div className="text-left">Date</div>
                <div className="text-left">Duration</div>
                <div className="text-center">RPE</div>
                <div className="text-center">Load</div>
              </div>
              <div className="relative flex-1 min-h-0" style={{ maxHeight: "364px" }}>
                <div
                  ref={scrollRef}
                  onScroll={updateFade}
                  className="overflow-y-auto overflow-x-hidden w-full"
                  style={{ maxHeight: "364px" }}
                >
                  {sessionsInPeriod.map((s, index) => {
                    const d = s.duration ?? 0;
                    const r = s.rpe ?? 0;
                    const load = s.load ?? d * r;
                    const isEven = index % 2 === 0;
                    const rowBg = isEven ? "#0f1720" : "#151d28";
                    return (
                      <div
                        key={s.id}
                        className="grid gap-x-0 min-h-[52px] items-center px-4 text-sm tabular-nums transition-[background-color,filter] hover:brightness-110 active:opacity-90"
                        style={{
                          gridTemplateColumns: "1.2fr 1fr 0.6fr 0.8fr",
                          backgroundColor: rowBg,
                        }}
                      >
                        <div className="text-left text-gray-300">{formatMonthDay(s.date)}</div>
                        <div className="text-left text-gray-300">{d} min</div>
                        <div className="text-center font-medium" style={rpeColorStyle(r)}>
                          {r}
                        </div>
                        <div className="text-center font-semibold text-white">{Math.round(load)}</div>
                      </div>
                    );
                  })}
                </div>
                <div
                  className="pointer-events-none absolute bottom-0 left-0 right-0 h-14 transition-opacity duration-200"
                  style={{
                    background: "linear-gradient(to top, rgba(13,17,23,0.95), transparent)",
                    opacity: showBottomFade ? 1 : 0,
                  }}
                  aria-hidden
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
