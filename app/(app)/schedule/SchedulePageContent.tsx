"use client";

import { Calendar } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { ScheduleCalendar } from "@/components/ScheduleCalendar";

export function SchedulePageContent({
  canEdit,
  isAdmin,
  isPlayer,
}: {
  canEdit: boolean;
  isAdmin: boolean;
  isPlayer: boolean;
}) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const description = canEdit ? "Tap a day to add or edit the program." : "Tap a day to see the program.";

  return (
    <div className={isPlayer ? "mx-auto max-w-4xl space-y-4" : ""}>
      <div>
        <h1 className="flex items-center gap-2 text-base font-bold tracking-tight text-white sm:text-lg lg:text-xl">
          <Calendar className="h-5 w-5 shrink-0 text-emerald-400 sm:h-6 sm:w-6" aria-hidden />
          <span>Schedule</span>
        </h1>
        <p className={`mt-0.5 text-xs sm:text-sm ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>{description}</p>
      </div>
      <ScheduleCalendar canEdit={canEdit} isAdmin={isAdmin} isPlayer={isPlayer} />
    </div>
  );
}
