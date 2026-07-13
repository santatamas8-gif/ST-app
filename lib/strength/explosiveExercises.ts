const EXPLOSIVE_EXERCISE_NAMES = new Set([
  "box squat jump sitting",
  "med ball throw sa stand",
  "smith machine band",
  "sl rdl jump",
]);

export function isExplosiveExercise(name: string | null | undefined): boolean {
  const key = (name ?? "").trim().toLowerCase();
  return EXPLOSIVE_EXERCISE_NAMES.has(key);
}

export function explosivePercentageLabel(name: string | null | undefined): string | null {
  return isExplosiveExercise(name) ? "max exp" : null;
}

export const EXPLOSIVE_EXERCISE_SEED = [
  {
    name: "Box Squat Jump Sitting",
    category: "Plyometric",
    percent: 0,
    related_to: "None",
    percent_bw_used: 0,
    equipment_used: "Bodyweight",
    rounding: 1,
    note: "Explosive",
    video_url: null,
    image_url: null,
    active: true,
  },
  {
    name: "Med Ball Throw SA Stand",
    category: "Plyometric",
    percent: 0,
    related_to: "None",
    percent_bw_used: 0,
    equipment_used: "Med Ball",
    rounding: 1,
    note: "Explosive",
    video_url: null,
    image_url: null,
    active: true,
  },
  {
    name: "Smith Machine Band",
    category: "Plyometric",
    percent: 0,
    related_to: "None",
    percent_bw_used: 0,
    equipment_used: "Smith Machine",
    rounding: 1,
    note: "Explosive",
    video_url: null,
    image_url: null,
    active: true,
  },
  {
    name: "SL RDL Jump",
    category: "Plyometric",
    percent: 0,
    related_to: "None",
    percent_bw_used: 0,
    equipment_used: "Bodyweight",
    rounding: 1,
    note: "Explosive",
    video_url: null,
    image_url: null,
    active: true,
  },
];

