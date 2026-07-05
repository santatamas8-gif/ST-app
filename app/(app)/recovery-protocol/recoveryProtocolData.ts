export type ProtocolDay = {
  id: string;
  label: string;
  pointGoal: number;
  focus: string;
  keyActions: string[];
  accent: {
    header: string;
    headerText: string;
    cardBorder: string;
    bullet: string;
    pointText: string;
  };
};

export type PhaseTimelineSegment = {
  id: string;
  label: string;
  span: number;
  bar: string;
  barText: string;
};

export type TherapyPointTier = {
  points: number;
  rowBorder: string;
  pointsBg: string;
  pointsText: string;
};

export type FoundationItem = {
  label: string;
  icon: "sleep" | "hydration" | "nutrition" | "meal";
};

export type TherapyPoint = {
  name: string;
  points: number;
};

export const PROTOCOL_DAYS: ProtocolDay[] = [
  {
    id: "md",
    label: "MD",
    pointGoal: 60,
    focus: "Post match recovery",
    keyActions: [
      "Compression boots",
      "Cold water",
      "Contrast water therapy",
      "Recovery meal + sleep",
    ],
    accent: {
      header: "bg-blue-600",
      headerText: "text-white",
      cardBorder: "border-blue-200",
      bullet: "text-blue-600",
      pointText: "text-blue-700",
    },
  },
  {
    id: "md+1",
    label: "MD+1",
    pointGoal: 80,
    focus: "Main recovery day",
    keyActions: [
      "Bike / walk",
      "Foam roll + mobility",
      "Cold water",
      "Contrast water therapy",
      "Pool / compression",
      "Massage gun",
    ],
    accent: {
      header: "bg-emerald-600",
      headerText: "text-white",
      cardBorder: "border-emerald-200",
      bullet: "text-emerald-600",
      pointText: "text-emerald-700",
    },
  },
  {
    id: "md+2",
    label: "MD+2",
    pointGoal: 100,
    focus: "Return toward readiness",
    keyActions: [
      "Bike / jogging",
      "Foam roll + mobility",
      "Pool exercise",
      "Compression boots",
      "Sauna / Hammam",
      "Massage gun",
      "Game Ready",
      "Dry needling",
    ],
    accent: {
      header: "bg-lime-500",
      headerText: "text-white",
      cardBorder: "border-lime-200",
      bullet: "text-lime-600",
      pointText: "text-lime-700",
    },
  },
  {
    id: "md+3",
    label: "MD+3",
    pointGoal: 70,
    focus: "Normal training state",
    keyActions: [
      "Foam roll + mobility",
      "Compression boots",
      "Bike",
      "Light massage",
      "Cold water",
      "Sauna / Hammam",
      "Pool exercise",
      "Dry needling",
    ],
    accent: {
      header: "bg-amber-500",
      headerText: "text-white",
      cardBorder: "border-amber-200",
      bullet: "text-amber-600",
      pointText: "text-amber-700",
    },
  },
  {
    id: "md-3",
    label: "MD-3",
    pointGoal: 60,
    focus: "Normal load tolerance",
    keyActions: [
      "Foam roll + mobility",
      "Compression boots",
      "Bike",
      "Light massage",
      "Cold water",
      "Massage gun",
    ],
    accent: {
      header: "bg-red-600",
      headerText: "text-white",
      cardBorder: "border-red-200",
      bullet: "text-red-600",
      pointText: "text-red-700",
    },
  },
  {
    id: "md-2",
    label: "MD-2",
    pointGoal: 50,
    focus: "Maintain freshness",
    keyActions: [
      "Foam roll + mobility",
      "Compression boots",
      "Bike",
      "Game Ready",
      "No heavy recovery",
    ],
    accent: {
      header: "bg-orange-500",
      headerText: "text-white",
      cardBorder: "border-orange-200",
      bullet: "text-orange-600",
      pointText: "text-orange-700",
    },
  },
  {
    id: "md-1",
    label: "MD-1",
    pointGoal: 30,
    focus: "Freshness / tapering",
    keyActions: [
      "Foam roll + mobility",
      "Feel freshest method",
      "No heavy recovery",
    ],
    accent: {
      header: "bg-teal-500",
      headerText: "text-white",
      cardBorder: "border-teal-200",
      bullet: "text-teal-600",
      pointText: "text-teal-700",
    },
  },
];

export const PHASE_TIMELINE: PhaseTimelineSegment[] = [
  { id: "match-day", label: "Match Day", span: 1, bar: "bg-blue-600", barText: "text-white" },
  { id: "recovery", label: "Recovery", span: 2, bar: "bg-emerald-600", barText: "text-white" },
  { id: "loading", label: "Loading", span: 2, bar: "bg-amber-500", barText: "text-white" },
  { id: "tapering", label: "Tapering", span: 2, bar: "bg-teal-500", barText: "text-white" },
];

export const THERAPY_POINT_TIERS: TherapyPointTier[] = [
  {
    points: 30,
    rowBorder: "border-blue-100",
    pointsBg: "bg-blue-100",
    pointsText: "text-blue-800",
  },
  {
    points: 25,
    rowBorder: "border-cyan-100",
    pointsBg: "bg-cyan-100",
    pointsText: "text-cyan-800",
  },
  {
    points: 20,
    rowBorder: "border-emerald-100",
    pointsBg: "bg-emerald-100",
    pointsText: "text-emerald-800",
  },
  {
    points: 15,
    rowBorder: "border-orange-100",
    pointsBg: "bg-orange-100",
    pointsText: "text-orange-800",
  },
  {
    points: 10,
    rowBorder: "border-violet-100",
    pointsBg: "bg-violet-100",
    pointsText: "text-violet-800",
  },
];

export const FOUNDATION_ITEMS: FoundationItem[] = [
  { label: "Sleep 8+ h", icon: "sleep" },
  { label: "Hydration", icon: "hydration" },
  { label: "Quality Nutrition", icon: "nutrition" },
  { label: "Post-match Recovery Meal", icon: "meal" },
];

export const FOUNDATION_WARNING =
  "Therapy points support recovery, but do not replace sleep, hydration, or food.";

export const THERAPY_POINT_BANK: TherapyPoint[] = [
  { name: "Cold Water Immersion", points: 30 },
  { name: "Foam Roller + Mobility", points: 30 },
  { name: "Pool Exercise", points: 30 },
  { name: "Easy Bike", points: 30 },
  { name: "Contrast Water Therapy", points: 25 },
  { name: "Compression Boots", points: 20 },
  { name: "Game Ready", points: 20 },
  { name: "Light Massage", points: 20 },
  { name: "Easy Jogging", points: 20 },
  { name: "Walk", points: 20 },
  { name: "Hydro Massage", points: 15 },
  { name: "Sauna / Hammam", points: 15 },
  { name: "Steam Bath", points: 15 },
  { name: "Dry Needling", points: 15 },
  { name: "Massage Gun", points: 10 },
];

/** Three-column layout for the therapy point bank infographic. */
export const THERAPY_POINT_COLUMNS: TherapyPoint[][] = [
  THERAPY_POINT_BANK.slice(0, 5),
  THERAPY_POINT_BANK.slice(5, 10),
  THERAPY_POINT_BANK.slice(10),
];

export const IMPORTANT_NOTES: string[] = [
  "Therapy points are supportive, not primary.",
  "Sleep, hydration, and nutrition remain the foundation.",
  "Use cold-water immersion mainly post-match or MD+1 after high load.",
  "Avoid aggressive recovery modalities on MD-1.",
];

export type RecoveryGuideSubgroup = {
  title: string;
  items: string[];
};

export type RecoveryGuideCategory = {
  id: string;
  title: string;
  items?: string[];
  note?: string;
  subgroups?: RecoveryGuideSubgroup[];
  mindMap: {
    side: "left" | "right";
    line: string;
    pill: string;
    pillActive: string;
    pillText: string;
    detailAccent: string;
  };
};

export const RECOVERY_GUIDE_DISCLAIMER =
  "Use these tips as practical guidance. They do not replace staff, medical, or nutrition recommendations.";

export const RECOVERY_GUIDE_DEFAULT_CATEGORY_ID = "sleep-rest";

export const RECOVERY_GUIDE_MIND_MAP_LEFT_IDS = [
  "training-pre-post",
  "stretching-mobility",
  "regeneration",
  "other",
] as const;

export const RECOVERY_GUIDE_MIND_MAP_RIGHT_IDS = [
  "sleep-rest",
  "nutrition",
  "hydration",
  "supplementation",
] as const;

export const RECOVERY_GUIDE_CATEGORIES: RecoveryGuideCategory[] = [
  {
    id: "sleep-rest",
    title: "Sleep & Rest",
    mindMap: {
      side: "right",
      line: "bg-violet-400",
      pill: "border-violet-300 bg-violet-50 hover:bg-violet-100",
      pillActive: "border-violet-500 bg-violet-500 text-white shadow-md shadow-violet-200",
      pillText: "text-violet-900",
      detailAccent: "border-violet-400 bg-violet-50",
    },
    items: [
      "Go to bed at a consistent time",
      "Wake up at a consistent time",
      "Aim for 8+ hours of good sleep",
      "Avoid screens before bedtime",
      "Avoid alcohol close to bedtime",
      "Avoid caffeine late in the day",
      "Avoid heavy meals before sleep",
      "Dark, cool, quiet room",
      "Breathing drills before sleep",
      "Warm shower if needed",
      "Short nap: 15–20 min",
      "Relax after hard training",
      "Feet-up relaxation",
      "Small protein snack before bed if needed",
    ],
  },
  {
    id: "nutrition",
    title: "Nutrition",
    mindMap: {
      side: "right",
      line: "bg-blue-500",
      pill: "border-blue-300 bg-blue-50 hover:bg-blue-100",
      pillActive: "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200",
      pillText: "text-blue-900",
      detailAccent: "border-blue-400 bg-blue-50",
    },
    items: [
      "Eat regular meals during the day",
      "Enough protein for recovery",
      "Enough calories for your training load",
      "Limit junk food",
      "Eat within 1 hour after training / match",
      "Protein + carbohydrates after training",
      "Vegetables / greens daily",
    ],
  },
  {
    id: "hydration",
    title: "Hydration",
    mindMap: {
      side: "right",
      line: "bg-purple-500",
      pill: "border-purple-300 bg-purple-50 hover:bg-purple-100",
      pillActive: "border-purple-600 bg-purple-600 text-white shadow-md shadow-purple-200",
      pillText: "text-purple-900",
      detailAccent: "border-purple-400 bg-purple-50",
    },
    items: [
      "Isotonic drink during hard sessions",
      "Electrolytes in hot weather",
      "3–4 L fluids per day",
      "More fluids in heat or high load",
      "Check bodyweight before / after training in hot weather",
    ],
  },
  {
    id: "supplementation",
    title: "Supplementation",
    mindMap: {
      side: "right",
      line: "bg-amber-400",
      pill: "border-amber-300 bg-amber-50 hover:bg-amber-100",
      pillActive: "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-200",
      pillText: "text-amber-900",
      detailAccent: "border-amber-400 bg-amber-50",
    },
    items: [
      "Only recommended supplements",
      "Minerals / vitamins if needed",
      "Joint support if recommended",
      "Omega-3 if recommended",
    ],
    note: "Supplements should only be used if recommended by staff, nutritionist, or medical team.",
  },
  {
    id: "training-pre-post",
    title: "Training Pre-Post",
    mindMap: {
      side: "left",
      line: "bg-red-500",
      pill: "border-red-300 bg-red-50 hover:bg-red-100",
      pillActive: "border-red-600 bg-red-600 text-white shadow-md shadow-red-200",
      pillText: "text-red-900",
      detailAccent: "border-red-400 bg-red-50",
    },
    items: [
      "Pre-workout snack if needed",
      "Mobility before training",
      "Individual pre-hab before training",
      "Proper cool-down after training",
      "Breathing drills after hard sessions",
      "Stretching / mobility after training",
      "Protein + carbs after training if needed",
    ],
  },
  {
    id: "stretching-mobility",
    title: "Stretching / Mobility / Prevention",
    mindMap: {
      side: "left",
      line: "bg-orange-500",
      pill: "border-orange-300 bg-orange-50 hover:bg-orange-100",
      pillActive: "border-orange-600 bg-orange-600 text-white shadow-md shadow-orange-200",
      pillText: "text-orange-900",
      detailAccent: "border-orange-400 bg-orange-50",
    },
    items: [
      "Foam rolling",
      "Stretching",
      "Mobility work",
      "Yoga if needed",
      "Pre-hab exercises",
      "Rehab exercises if prescribed",
    ],
  },
  {
    id: "regeneration",
    title: "Regeneration Modalities",
    mindMap: {
      side: "left",
      line: "bg-teal-500",
      pill: "border-teal-300 bg-teal-50 hover:bg-teal-100",
      pillActive: "border-teal-600 bg-teal-600 text-white shadow-md shadow-teal-200",
      pillText: "text-teal-900",
      detailAccent: "border-teal-400 bg-teal-50",
    },
    items: [
      "Full-body massage",
      "Partial massage",
      "Cold bath / cold shower after high load",
      "Hot-cold contrast when appropriate",
      "Compression socks",
      "Sauna / spa",
      "Game Ready / Normatec",
      "Breathing drills",
      "Meditation",
      "Visualization",
      "Pool recovery",
      "Light cycling / swimming",
    ],
  },
  {
    id: "other",
    title: "Other",
    mindMap: {
      side: "left",
      line: "bg-sky-400",
      pill: "border-sky-300 bg-sky-50 hover:bg-sky-100",
      pillActive: "border-sky-500 bg-sky-500 text-white shadow-md shadow-sky-200",
      pillText: "text-sky-900",
      detailAccent: "border-sky-400 bg-sky-50",
    },
    subgroups: [
      {
        title: "Social recovery",
        items: [
          "Family time",
          "Call family or close friends",
          "Relaxed time with friends",
        ],
      },
      {
        title: "Training habits",
        items: [
          "Review the previous game",
          "Study the next opponent",
          "Watch tactical clips",
          "Learn something useful for your sport",
        ],
      },
      {
        title: "Mental switch-off",
        items: [
          "Do something you enjoy",
          "Choose what helps you relax",
          "Disconnect from football for a short time",
        ],
      },
    ],
  },
];

export function getRecoveryGuideCategory(id: string): RecoveryGuideCategory | undefined {
  return RECOVERY_GUIDE_CATEGORIES.find((category) => category.id === id);
}

export function getTherapyPointTier(points: number): TherapyPointTier {
  return (
    THERAPY_POINT_TIERS.find((tier) => tier.points === points) ?? THERAPY_POINT_TIERS[THERAPY_POINT_TIERS.length - 1]
  );
}
