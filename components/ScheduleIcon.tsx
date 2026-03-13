"use client";

import type { ScheduleActivityType } from "@/lib/types";

const SIZE = 24;
const SIZE_MEDIA = 30;
const CLASS = "shrink-0 text-zinc-400";

/** Meals (breakfast, lunch, dinner) share one icon; every other type has its own. */
export function ScheduleIcon({ type, className = "", size: sizeProp }: { type: ScheduleActivityType | string; className?: string; size?: number }) {
  const s = sizeProp ?? SIZE;
  const sMedia = sizeProp != null ? Math.round((SIZE_MEDIA / SIZE) * sizeProp) : SIZE_MEDIA;
  const c = `${CLASS} ${className}`.trim();

  const mealTypes = ["breakfast", "lunch", "dinner"];
  const isMeal = mealTypes.includes(type);

  if (isMeal) {
    return (
      <img src="/icons/meals-plate.svg" width={s} height={s} alt="" className={c} aria-hidden />
    );
  }

  switch (type) {
    case "arrival":
      return (
        <img
          src="/icons/clock-arrival.svg"
          width={s}
          height={s}
          alt=""
          className={c}
          aria-hidden
        />
      );
    case "training":
      return (
        <img src="/icons/training-soccer.svg" width={s} height={s} alt="" className={c} aria-hidden />
      );
    case "gym":
      return (
        <img src="/icons/gym-dumbbell.svg" width={s} height={s} alt="" className={c} aria-hidden />
      );
    case "recovery":
      return (
        <img src="/icons/recovery-swim.svg" width={s} height={s} alt="" className={c} aria-hidden />
      );
    case "pre_activation":
      return (
        <img src="/icons/pre-activation-yoga.svg" width={s} height={s} alt="" className={c} aria-hidden />
      );
    case "video_analysis":
      return (
        <img src="/icons/video-analysis-cinema.svg" width={s} height={s} alt="" className={c} aria-hidden />
      );
    case "meeting":
      return (
        <img src="/icons/meeting-interview.svg" width={s} height={s} alt="" className={c} aria-hidden />
      );
    case "traveling":
      return (
        <img src="/icons/traveling-bus.svg" width={s} height={s} alt="" className={c} aria-hidden />
      );
    case "medical":
      return (
        <img src="/icons/medical-doctor.svg" width={s} height={s} alt="" className={c} aria-hidden />
      );
    case "physio":
      return (
        <img src="/icons/physio-doctor.svg" width={s} height={s} alt="" className={c} aria-hidden />
      );
    case "media":
      return (
        <img src="/icons/camera-media.svg" width={sMedia} height={sMedia} alt="" className={c} aria-hidden />
      );
    case "rest_off":
      return (
        <img src="/icons/rest-off-sleep.svg" width={s} height={s} alt="" className={c} aria-hidden />
      );
    case "match":
      return (
        <img src="/icons/match-stadium.svg" width={s} height={s} alt="" className={c} aria-hidden />
      );
    case "team_building":
      return (
        <img src="/icons/team-building-group.svg" width={s} height={s} alt="" className={c} aria-hidden />
      );
    case "individual":
      return (
        <img src="/icons/individual-player.svg" width={s} height={s} alt="" className={c} aria-hidden />
      );
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c} aria-hidden>
          <rect width="18" height="18" x="3" y="4" rx="1.5" />
          <path d="M16 2v4M8 2v4" />
          <path d="M3 10h18" />
        </svg>
      );
  }
}
