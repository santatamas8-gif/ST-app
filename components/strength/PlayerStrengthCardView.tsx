import type { PlayerCardItem } from "@/lib/strength/types";
import { groupCardItemsByExercise, type ExerciseGroup } from "@/lib/strength/cardLayout";
import { ExerciseImage } from "./ExerciseImage";
import { PlayerAvatar } from "./PlayerAvatar";
import { StrengthSetTable } from "./StrengthSetTable";

interface PlayerStrengthCardViewProps {
  playerName: string;
  playerAvatarUrl?: string | null;
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
          className="aspect-square h-[72px] w-[72px] shrink-0 sm:h-20 sm:w-20"
        />
        <div className="min-w-0 flex-1 overflow-x-auto">
          <StrengthSetTable sets={group.sets} variant="screen" />
        </div>
      </div>
    </article>
  );
}

export function PlayerStrengthCardView({
  playerName,
  playerAvatarUrl,
  date,
  title,
  sessionType,
  items,
  exerciseImages,
}: PlayerStrengthCardViewProps) {
  const groups = groupCardItemsByExercise(items, 8, exerciseImages);
  const left = groups.slice(0, 4);
  const right = groups.slice(4, 8);
  const sessionLine = sessionType ? `${title} · ${sessionType}` : title;

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-4 border-b border-zinc-700/60 pb-4">
        <PlayerAvatar name={playerName} avatarUrl={playerAvatarUrl} variant="screen" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">{playerName}</h2>
          <p className="mt-1 text-sm text-zinc-400">{date}</p>
          <p className="mt-0.5 text-sm text-zinc-500">{sessionLine}</p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 md:gap-5">
        <div className="space-y-4">
          {left.map((g) => (
            <ExerciseBlock key={g.key} group={g} />
          ))}
        </div>
        {right.length > 0 && (
          <div className="space-y-4">
            {right.map((g) => (
              <ExerciseBlock key={g.key} group={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
