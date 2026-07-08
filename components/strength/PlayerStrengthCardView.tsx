import type { PlayerCardItem } from "@/lib/strength/types";
import { groupCardItemsByExercise, type ExerciseGroup } from "@/lib/strength/cardLayout";
import { ExerciseImage } from "./ExerciseImage";
import { STRENGTH_CARD_EXERCISE_IMAGE_CLASS, StrengthCardHeader } from "./StrengthCardHeader";
import { StrengthSetTable } from "./StrengthSetTable";

interface PlayerStrengthCardViewProps {
  playerName: string;
  playerAvatarUrl?: string | null;
  teamLogoUrl?: string | null;
  date: string;
  title: string;
  sessionType?: string;
  items: PlayerCardItem[];
  exerciseImages?: Record<string, string | null>;
}

function ExerciseBlock({ group }: { group: ExerciseGroup }) {
  return (
    <article className="overflow-hidden rounded-lg border border-zinc-700/50 bg-zinc-900/30">
      <h3 className="border-b border-zinc-700/40 px-3 py-2.5 text-sm font-semibold text-white sm:px-4 sm:text-base">
        {group.name}
      </h3>
      <div className="flex items-start gap-3 p-3 sm:gap-4 sm:p-4">
        <ExerciseImage
          src={group.imageUrl}
          alt={group.name}
          className={STRENGTH_CARD_EXERCISE_IMAGE_CLASS}
        />
        <div className="min-w-0 flex-1 overflow-x-auto">
          <StrengthSetTable sets={group.sets} variant="screen" repsOnlyPullUp={group.repsOnlyPullUp} />
        </div>
      </div>
    </article>
  );
}

export function PlayerStrengthCardView({
  playerName,
  playerAvatarUrl,
  teamLogoUrl,
  date,
  title,
  sessionType,
  items,
  exerciseImages,
}: PlayerStrengthCardViewProps) {
  const groups = groupCardItemsByExercise(items, 8, exerciseImages);
  const sessionLine = sessionType ? `${title} · ${sessionType}` : title;

  return (
    <div className="space-y-5">
      <StrengthCardHeader
        playerName={playerName}
        playerAvatarUrl={playerAvatarUrl}
        teamLogoUrl={teamLogoUrl}
        date={date}
        sessionLine={sessionLine}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start sm:gap-x-5 sm:gap-y-4 sm:[grid-auto-flow:column] sm:[grid-template-rows:repeat(4,auto)]">
        {groups.map((g) => (
          <ExerciseBlock key={g.key} group={g} />
        ))}
      </div>
    </div>
  );
}
