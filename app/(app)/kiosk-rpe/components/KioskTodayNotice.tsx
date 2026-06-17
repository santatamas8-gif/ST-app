"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { getKioskTodayNoticeText } from "@/lib/kioskRpe/submissionConfirmation";

const CARD_RADIUS = "12px";

type KioskTodayNoticeProps = {
  todayBatchCount: number;
  countUnavailable?: boolean;
};

export function KioskTodayNotice({
  todayBatchCount,
  countUnavailable = false,
}: KioskTodayNoticeProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const noticeText = getKioskTodayNoticeText(todayBatchCount);

  if (!countUnavailable && !noticeText) return null;

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
        isHighContrast
          ? "border-white/20 bg-white/[0.04] text-white/85"
          : "border-zinc-800 bg-zinc-900/50 text-zinc-300"
      }`}
      style={{ borderRadius: CARD_RADIUS }}
      role={countUnavailable ? "status" : undefined}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
        <p>
          {countUnavailable
            ? "Today's previous Kiosk submissions could not be checked."
            : noticeText}
        </p>
      </div>
      {!countUnavailable && (
        <Link
          href="/rpe#recent-kiosk-sessions"
          className="min-h-[36px] shrink-0 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-center text-xs font-semibold text-emerald-400 transition hover:bg-zinc-700/80 hover:text-emerald-300"
        >
          View on RPE page
        </Link>
      )}
    </div>
  );
}
