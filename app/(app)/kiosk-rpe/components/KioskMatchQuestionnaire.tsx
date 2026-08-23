"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  PHYSICAL_DROPOFF_OPTIONS,
  PRE_MATCH_FEELINGS,
  PRE_MATCH_OTHER_MAX_LENGTH,
  PRE_MATCH_OTHER_OPTION,
  type PhysicalDropoff,
  type PreMatchFeeling,
} from "@/lib/matchFeedback/constants";
import { formatMatchFeedbackDate } from "@/lib/matchFeedback/format";
import { isMatchFeedbackFormReady } from "@/lib/matchFeedback/questionnaireReady";
import { submitMatchFeedbackResponse } from "@/lib/matchFeedback/apiClient";
import {
  dropoffLabel,
  feelingLabel,
  getMatchQuestionnaireCopy,
  MATCH_QUESTIONNAIRE_LOCALES,
  mentalDemandLabels,
  performanceLabels,
  physicalDemandLabels,
  type MatchQuestionnaireLocale,
} from "@/lib/matchFeedback/questionnaireI18n";
import type { MatchFeedbackMatch, MatchFeedbackResponse } from "@/lib/matchFeedback/types";
import type { KioskPlayer } from "@/lib/players/listPlayers";
import { KioskPlayerAvatar } from "./KioskPlayerAvatar";
import { MatchFeedbackScale } from "./MatchFeedbackScale";
import {
  MF_QUESTION_CARD,
  MF_QUESTION_HINT,
  MF_QUESTION_TITLE,
  neutralOptionClass,
} from "./matchFeedbackQuestionnaireStyles";

type KioskMatchQuestionnaireProps = {
  match: MatchFeedbackMatch;
  player: KioskPlayer;
  existing: MatchFeedbackResponse | null;
  onCancel: () => void;
  onSaved: (response: MatchFeedbackResponse) => void;
};

export function KioskMatchQuestionnaire({
  match,
  player,
  existing,
  onCancel,
  onSaved,
}: KioskMatchQuestionnaireProps) {
  const [locale, setLocale] = useState<MatchQuestionnaireLocale>("en");
  const [feelings, setFeelings] = useState<PreMatchFeeling[]>(
    () => existing?.pre_match_feelings ?? []
  );
  const [otherText, setOtherText] = useState(() => existing?.pre_match_other_text ?? "");
  const [physicalDemand, setPhysicalDemand] = useState<number | null>(
    () => existing?.physical_demand ?? null
  );
  const [performanceRating, setPerformanceRating] = useState<number | null>(
    () => existing?.performance_rating ?? null
  );
  const [dropoff, setDropoff] = useState<PhysicalDropoff | null>(
    () => existing?.physical_dropoff ?? null
  );
  const [mentalDemand, setMentalDemand] = useState<number | null>(
    () => existing?.mental_demand ?? null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = getMatchQuestionnaireCopy(locale);
  const isUpdate = Boolean(existing);
  const wantsOther = feelings.includes(PRE_MATCH_OTHER_OPTION);

  const canSubmit = useMemo(
    () =>
      isMatchFeedbackFormReady({
        feelings,
        otherText,
        physicalDemand,
        performanceRating,
        dropoff,
        mentalDemand,
      }),
    [feelings, otherText, physicalDemand, performanceRating, dropoff, mentalDemand]
  );

  function toggleFeeling(option: PreMatchFeeling) {
    setFeelings((prev) =>
      prev.includes(option) ? prev.filter((f) => f !== option) : [...prev, option]
    );
  }

  async function handleSubmit() {
    if (
      physicalDemand == null ||
      performanceRating == null ||
      mentalDemand == null ||
      !dropoff ||
      !canSubmit ||
      busy
    ) {
      return;
    }
    setBusy(true);
    setError(null);

    // Always submit English canonical values — locale is display-only.
    const result = await submitMatchFeedbackResponse({
      matchId: match.id,
      playerId: player.id,
      preMatchFeelings: feelings,
      preMatchOtherText: wantsOther ? otherText : null,
      physicalDemand,
      performanceRating,
      physicalDropoff: dropoff,
      mentalDemand,
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onSaved({
      id: result.responseId,
      match_id: match.id,
      player_id: player.id,
      pre_match_feelings: feelings,
      pre_match_other_text: wantsOther ? otherText.trim() : null,
      physical_demand: physicalDemand,
      performance_rating: performanceRating,
      physical_dropoff: dropoff,
      mental_demand: mentalDemand,
      created_at: existing?.created_at ?? result.updatedAt,
      updated_at: result.updatedAt,
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-1 sm:px-2">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {copy.backToPlayers}
        </button>

        <div
          className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-950/80 p-1"
          role="group"
          aria-label={copy.languageSwitcherAria}
        >
          {MATCH_QUESTIONNAIRE_LOCALES.map((item) => {
            const selected = locale === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setLocale(item.id)}
                aria-pressed={selected}
                aria-label={item.label}
                title={item.label}
                className={`flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-base leading-none transition ${
                  selected
                    ? "bg-zinc-100 ring-2 ring-emerald-500/70"
                    : "opacity-55 hover:bg-zinc-800 hover:opacity-100"
                }`}
              >
                <span aria-hidden>{item.flag}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-md sm:p-6">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white p-5 text-center shadow-sm">
          <KioskPlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size="gate" />
          <div>
            <p className="text-lg font-semibold text-zinc-900 sm:text-xl">{player.name}</p>
            <p className="mt-1 text-sm text-zinc-600">
              vs {match.opponent}
              <span className="mx-2 text-zinc-300">·</span>
              {formatMatchFeedbackDate(match.match_date)}
              <span className="mx-2 text-zinc-300">·</span>
              {copy.matchday(match.matchday)}
            </p>
          </div>
        </div>

        <section className={MF_QUESTION_CARD}>
          <h2 className={MF_QUESTION_TITLE}>
            {copy.q1Title}
            <span className={MF_QUESTION_HINT}>{copy.q1Hint}</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {PRE_MATCH_FEELINGS.map((option) => {
              const selected = feelings.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleFeeling(option)}
                  className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${neutralOptionClass(
                    selected
                  )}`}
                >
                  {feelingLabel(locale, option)}
                </button>
              );
            })}
          </div>
          {wantsOther ? (
            <div className="space-y-1.5">
              <label htmlFor="match-other-text" className="text-sm font-medium text-zinc-700">
                {copy.pleaseSpecify}
              </label>
              <input
                id="match-other-text"
                type="text"
                value={otherText}
                maxLength={PRE_MATCH_OTHER_MAX_LENGTH}
                onChange={(e) => setOtherText(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                placeholder={copy.otherPlaceholder}
              />
            </div>
          ) : null}
        </section>

        <section className={MF_QUESTION_CARD}>
          <MatchFeedbackScale
            label={copy.q2Title}
            value={physicalDemand}
            onChange={setPhysicalDemand}
            valueLabels={physicalDemandLabels(locale)}
            colorScale="demand"
          />
        </section>

        <section className={MF_QUESTION_CARD}>
          <MatchFeedbackScale
            label={copy.q3Title}
            value={mentalDemand}
            onChange={setMentalDemand}
            valueLabels={mentalDemandLabels(locale)}
            colorScale="demand"
          />
        </section>

        <section className={MF_QUESTION_CARD}>
          <h2 className={MF_QUESTION_TITLE}>{copy.q4Title}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {PHYSICAL_DROPOFF_OPTIONS.map((option) => {
              const selected = dropoff === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDropoff(option)}
                  className={`min-h-[48px] rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${neutralOptionClass(
                    selected
                  )}`}
                >
                  {dropoffLabel(locale, option)}
                </button>
              );
            })}
          </div>
        </section>

        <section className={MF_QUESTION_CARD}>
          <MatchFeedbackScale
            label={copy.q5Title}
            value={performanceRating}
            onChange={setPerformanceRating}
            valueLabels={performanceLabels(locale)}
            colorScale="performance"
          />
        </section>

        {error ? (
          <p
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!canSubmit || busy}
          onClick={() => void handleSubmit()}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {isUpdate ? copy.update : copy.submit}
        </button>
      </div>
    </div>
  );
}
