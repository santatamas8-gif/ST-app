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
  const description =
    "Daily program (breakfast, lunch, dinner, training, gym, recovery, pre-activation). " +
    (canEdit ? "Click a day to add or remove items." : "View the program for each day.");

  return (
    <div className={isPlayer ? "mx-auto max-w-4xl space-y-6" : ""}>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
          <Calendar className="h-7 w-7 shrink-0 text-emerald-400" aria-hidden />
          <span>Schedule</span>
        </h1>
        <p className={`mt-1 ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>{description}</p>
      </div>
      <ScheduleCalendar canEdit={canEdit} isAdmin={isAdmin} />
    </div>
  );
}
