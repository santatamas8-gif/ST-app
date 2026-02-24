"use client";

import type { ScheduleActivityType } from "@/lib/types";

const SIZE = 20;
const CLASS = "shrink-0 text-zinc-400";

/** Meals (breakfast, lunch, dinner) share one icon; every other type has its own. */
export function ScheduleIcon({ type, className = "" }: { type: ScheduleActivityType | string; className?: string }) {
  const c = `${CLASS} ${className}`.trim();

  const mealTypes = ["breakfast", "lunch", "dinner"];
  const isMeal = mealTypes.includes(type);

  if (isMeal) {
    return (
      <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c} aria-hidden>
        <circle cx="12" cy="14" r="6" />
        <circle cx="12" cy="14" r="4" strokeOpacity={0.6} />
        <path d="M9 8 Q12 5 15 8M10 7 Q12 4 14 7M14 7 Q16 4 18 7M11 6.5 Q12 4.5 13 6.5" />
      </svg>
    );
  }

  switch (type) {
    case "training":
      return (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c} aria-hidden>
          <rect x="2" y="4" width="20" height="16" rx="1" />
          <path d="M12 4v16" />
          <circle cx="12" cy="12" r="3" />
          <path d="M4 8h2M4 16h2M18 8h2M18 16h2" strokeWidth="1.5" strokeOpacity={0.7} />
        </svg>
      );
    case "gym":
      return (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c} aria-hidden>
          <circle cx="7" cy="12" r="3.5" />
          <circle cx="7" cy="12" r="2" strokeOpacity={0.5} />
          <path d="M10.5 12h3M10.5 11.2h3M10.5 12.8h3" />
          <circle cx="17" cy="12" r="3.5" />
          <circle cx="17" cy="12" r="2" strokeOpacity={0.5} />
        </svg>
      );
    case "recovery":
      return (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c} aria-hidden>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="M2 10h20" />
          <path d="M6 10v4M10 10v4M14 10v4M18 10v4" />
          <path d="M4 8v2M20 8v2M2 14h20" strokeOpacity={0.6} />
        </svg>
      );
    case "pre_activation":
      return (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c} aria-hidden>
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
          <path d="M7 10l2-2 2 2M11 6l1-1" strokeWidth="1.5" strokeOpacity={0.8} />
        </svg>
      );
    case "video_analysis":
      return (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c} aria-hidden>
          <path d="m22 8-6 4 6 4V8Z" />
          <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
          <path d="M5 9h4M5 12h6M5 15h4" strokeOpacity={0.5} />
        </svg>
      );
    case "meeting":
      return (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c} aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          <path d="M4 14h16" strokeOpacity={0.5} />
        </svg>
      );
    case "traveling":
      return (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c} aria-hidden>
          <rect x="2" y="6" width="20" height="10" rx="1" />
          <path d="M6 6V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
          <path d="M8 9v4M12 9v4M16 9v4" strokeOpacity={0.6} />
          <path d="M6 16h12" />
          <circle cx="7" cy="17" r="1.5" />
          <circle cx="17" cy="17" r="1.5" />
        </svg>
      );
    case "physio":
      return (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c} aria-hidden>
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          <path d="M12 8v4M10 10h4" />
          <path d="M12 10.5l-1 1.5 1 1.5 1-1.5z" strokeOpacity={0.6} />
        </svg>
      );
    case "medical":
      return (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${c} text-red-400`} aria-hidden>
          <path d="M12 4v16M4 12h16" />
          <rect x="10" y="10" width="4" height="4" rx="0.5" strokeOpacity={0.5} />
        </svg>
      );
    case "media":
      return (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c} aria-hidden>
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <circle cx="12" cy="13" r="3" />
          <circle cx="12" cy="13" r="1.5" strokeOpacity={0.5} />
        </svg>
      );
    case "rest_off":
      return (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c} aria-hidden>
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          <path d="M8 5l1 1M16 5l-1 1M12 2v2" strokeOpacity={0.6} />
        </svg>
      );
    case "match":
      return (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c} aria-hidden>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4 A8 8 0 0 1 12 20 M12 4 A8 8 0 0 0 12 20" />
          <path d="M4 12 A8 8 0 0 1 20 12 M4 12 A8 8 0 0 0 20 12" />
          <path d="M7 7 A8 8 0 0 1 17 17 M17 7 A8 8 0 0 1 7 17" strokeOpacity={0.6} />
        </svg>
      );
    case "team_building":
      return (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c} aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-4-4h-1.5" />
          <path d="M16 3.13a4 4 0 0 1 2.16 5.3" />
          <path d="M12 11v6M9 14h6" />
          <path d="M9 11v1M15 11v1" strokeOpacity={0.5} />
        </svg>
      );
    case "individual":
      return (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c} aria-hidden>
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
          <path d="M10 12h4M11 15h2" strokeOpacity={0.5} />
        </svg>
      );
    default:
      return (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c} aria-hidden>
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
        </svg>
      );
  }
}
