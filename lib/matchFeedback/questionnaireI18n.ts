/**
 * Kiosk Match questionnaire UI translations only.
 * Stored values remain English canonical labels from constants.ts.
 * Results views stay English and do not use this module.
 */

import type { PhysicalDropoff, PreMatchFeeling } from "./constants";
import {
  MENTAL_DEMAND_LABELS,
  PERFORMANCE_RATING_LABELS,
  PHYSICAL_DEMAND_LABELS,
  PHYSICAL_DROPOFF_OPTIONS,
  PRE_MATCH_FEELINGS,
} from "./constants";

export type MatchQuestionnaireLocale = "en" | "ro" | "fr";

export const MATCH_QUESTIONNAIRE_LOCALES: {
  id: MatchQuestionnaireLocale;
  flag: string;
  label: string;
}[] = [
  { id: "en", flag: "🇬🇧", label: "English" },
  { id: "ro", flag: "🇷🇴", label: "Română" },
  { id: "fr", flag: "🇫🇷", label: "Français" },
];

type QuestionnaireUiCopy = {
  backToPlayers: string;
  matchday: (n: number) => string;
  q1Title: string;
  q1Hint: string;
  pleaseSpecify: string;
  otherPlaceholder: string;
  q2Title: string;
  q3Title: string;
  q4Title: string;
  q5Title: string;
  submit: string;
  update: string;
  languageSwitcherAria: string;
};

const UI: Record<MatchQuestionnaireLocale, QuestionnaireUiCopy> = {
  en: {
    backToPlayers: "Back to players",
    matchday: (n) => `Matchday ${n}`,
    q1Title: "How did you feel before the match?",
    q1Hint: "(select all that apply)",
    pleaseSpecify: "Please specify",
    otherPlaceholder: "Type your answer",
    q2Title: "How hard was the match physically?",
    q3Title: "How hard was the match mentally?",
    q4Title: "When did you first feel a physical drop-off?",
    q5Title: "How would you rate your performance?",
    submit: "Submit",
    update: "Update Response",
    languageSwitcherAria: "Questionnaire language",
  },
  ro: {
    backToPlayers: "Înapoi la jucători",
    matchday: (n) => `Etapa ${n}`,
    q1Title: "Cum te-ai simțit înainte de meci?",
    q1Hint: "(selectează tot ce se aplică)",
    pleaseSpecify: "Te rugăm să precizezi",
    otherPlaceholder: "Scrie răspunsul tău",
    q2Title: "Cât de greu a fost meciul fizic?",
    q3Title: "Cât de greu a fost meciul mental?",
    q4Title: "Când ai simțit prima dată o scădere fizică?",
    q5Title: "Cum ți-ai evalua performanța?",
    submit: "Trimite",
    update: "Actualizează răspunsul",
    languageSwitcherAria: "Limba chestionarului",
  },
  fr: {
    backToPlayers: "Retour aux joueurs",
    matchday: (n) => `Journée ${n}`,
    q1Title: "Comment vous sentiez-vous avant le match ?",
    q1Hint: "(sélectionnez tout ce qui s'applique)",
    pleaseSpecify: "Veuillez préciser",
    otherPlaceholder: "Tapez votre réponse",
    q2Title: "À quel point le match était-il difficile physiquement ?",
    q3Title: "À quel point le match était-il difficile mentalement ?",
    q4Title: "Quand avez-vous ressenti pour la première fois une baisse physique ?",
    q5Title: "Comment évalueriez-vous votre performance ?",
    submit: "Envoyer",
    update: "Mettre à jour la réponse",
    languageSwitcherAria: "Langue du questionnaire",
  },
};

const FEELING_LABELS: Record<MatchQuestionnaireLocale, Record<PreMatchFeeling, string>> = {
  en: Object.fromEntries(PRE_MATCH_FEELINGS.map((f) => [f, f])) as Record<
    PreMatchFeeling,
    string
  >,
  ro: {
    Prepared: "Pregătit",
    Fresh: "Proaspăt",
    "Slight muscle soreness": "Ușoară durere musculară",
    "Heavy legs": "Picioare grele",
    Tired: "Obosit",
    Stressed: "Stresat",
    "Muscle tightness": "Înțepenire musculară",
    "Pain / discomfort": "Durere / disconfort",
    "Low energy": "Energie scăzută",
    "Not fully recovered": "Nu sunt complet recuperat",
    Other: "Altele",
  },
  fr: {
    Prepared: "Préparé",
    Fresh: "Frais",
    "Slight muscle soreness": "Légères courbatures",
    "Heavy legs": "Jambes lourdes",
    Tired: "Fatigué",
    Stressed: "Stressé",
    "Muscle tightness": "Raideur musculaire",
    "Pain / discomfort": "Douleur / inconfort",
    "Low energy": "Faible énergie",
    "Not fully recovered": "Pas complètement récupéré",
    Other: "Autre",
  },
};

const DROPOFF_LABELS: Record<MatchQuestionnaireLocale, Record<PhysicalDropoff, string>> = {
  en: Object.fromEntries(PHYSICAL_DROPOFF_OPTIONS.map((o) => [o, o])) as Record<
    PhysicalDropoff,
    string
  >,
  ro: {
    "No drop-off": "Fără scădere",
    "First half": "Prima repriză",
    "45–60 min": "45–60 min",
    "60–75 min": "60–75 min",
    "75–90+ min": "75–90+ min",
  },
  fr: {
    "No drop-off": "Pas de baisse",
    "First half": "Première mi-temps",
    "45–60 min": "45–60 min",
    "60–75 min": "60–75 min",
    "75–90+ min": "75–90+ min",
  },
};

const PHYSICAL_DEMAND_I18N: Record<MatchQuestionnaireLocale, Record<number, string>> = {
  en: PHYSICAL_DEMAND_LABELS,
  ro: {
    1: "Foarte ușor",
    2: "Ușor",
    3: "Destul de ușor",
    4: "Puțin greu",
    5: "Moderat",
    6: "Destul de greu",
    7: "Greu",
    8: "Foarte greu",
    9: "Extrem de greu",
    10: "Efort maxim",
  },
  fr: {
    1: "Très facile",
    2: "Facile",
    3: "Assez facile",
    4: "Un peu difficile",
    5: "Modéré",
    6: "Assez difficile",
    7: "Difficile",
    8: "Très difficile",
    9: "Extrêmement difficile",
    10: "Effort maximum",
  },
};

const MENTAL_DEMAND_I18N: Record<MatchQuestionnaireLocale, Record<number, string>> = {
  en: MENTAL_DEMAND_LABELS,
  ro: {
    1: "Foarte ușor",
    2: "Ușor",
    3: "Destul de ușor",
    4: "Puțin solicitant",
    5: "Moderat",
    6: "Destul de solicitant",
    7: "Solicitant",
    8: "Foarte solicitant",
    9: "Extrem de solicitant",
    10: "Solicitare mentală maximă",
  },
  fr: {
    1: "Très facile",
    2: "Facile",
    3: "Assez facile",
    4: "Légèrement exigeant",
    5: "Modéré",
    6: "Assez exigeant",
    7: "Exigeant",
    8: "Très exigeant",
    9: "Extrêmement exigeant",
    10: "Exigence mentale maximale",
  },
};

const PERFORMANCE_I18N: Record<MatchQuestionnaireLocale, Record<number, string>> = {
  en: PERFORMANCE_RATING_LABELS,
  ro: {
    1: "Foarte slab",
    2: "Slab",
    3: "Sub medie",
    4: "Puțin sub medie",
    5: "Mediu",
    6: "Puțin peste medie",
    7: "Bun",
    8: "Foarte bun",
    9: "Excelent",
    10: "Cea mai bună performanță",
  },
  fr: {
    1: "Très faible",
    2: "Faible",
    3: "Sous la moyenne",
    4: "Légèrement sous la moyenne",
    5: "Moyen",
    6: "Légèrement au-dessus de la moyenne",
    7: "Bon",
    8: "Très bon",
    9: "Excellent",
    10: "Meilleure performance possible",
  },
};

export function getMatchQuestionnaireCopy(locale: MatchQuestionnaireLocale): QuestionnaireUiCopy {
  return UI[locale];
}

export function feelingLabel(locale: MatchQuestionnaireLocale, value: PreMatchFeeling): string {
  return FEELING_LABELS[locale][value] ?? value;
}

export function dropoffLabel(locale: MatchQuestionnaireLocale, value: PhysicalDropoff): string {
  return DROPOFF_LABELS[locale][value] ?? value;
}

export function physicalDemandLabels(locale: MatchQuestionnaireLocale): Record<number, string> {
  return PHYSICAL_DEMAND_I18N[locale];
}

export function mentalDemandLabels(locale: MatchQuestionnaireLocale): Record<number, string> {
  return MENTAL_DEMAND_I18N[locale];
}

export function performanceLabels(locale: MatchQuestionnaireLocale): Record<number, string> {
  return PERFORMANCE_I18N[locale];
}
