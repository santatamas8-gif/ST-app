import type { ScheduleActivityType } from "@/lib/types";

export function getScheduleActivityBg(type: ScheduleActivityType | string) {
  const t = type as ScheduleActivityType;

  // Meals: single shared color (melegebb, sötétebb sárga – jobb kontraszt a fehér ikonhoz)
  if (t === "breakfast" || t === "lunch" || t === "dinner") {
    return "bg-amber-400/25";
  }

  // Arrival
  if (t === "arrival") {
    return "bg-orange-500/25";
  }

  // Training-related (stronger greens / teals, but separated)
  if (t === "training") return "bg-emerald-500/30";
  if (t === "gym") return "bg-lime-500/25";
  if (t === "recovery") return "bg-sky-400/25";
  if (t === "pre_activation") return "bg-amber-400/25";

  // Video
  if (t === "video_analysis") return "bg-violet-500/25";

  // Travel & logistics
  if (t === "traveling") return "bg-amber-500/25";

  // Health
  if (t === "physio") return "bg-sky-500/25";
  if (t === "medical") return "bg-rose-500/25";

  // Meetings / media / team building
  if (t === "meeting") return "bg-indigo-500/25";
  if (t === "media") return "bg-fuchsia-500/25";
  if (t === "team_building") return "bg-purple-500/25";

  // Rest / match / individual
  if (t === "rest_off") return "bg-blue-500/20";
  if (t === "match") return "bg-red-500/25";
  if (t === "individual") return "bg-emerald-400/25";

  return "bg-zinc-900/70";
}

