import {
  listPlannerUiPlayers,
  listPlannerWeeksAction,
} from "@/app/actions/gpsPlanner";
import { GpsLoadPlannerView } from "./GpsLoadPlannerView";

export const dynamic = "force-dynamic";

export default async function WeeklyPlannerPage() {
  const [weeksResult, playersResult] = await Promise.all([
    listPlannerWeeksAction(),
    listPlannerUiPlayers(),
  ]);

  const weeks = weeksResult.ok ? weeksResult.data : [];
  const players = playersResult.ok ? playersResult.data : [];
  const loadError =
    (!weeksResult.ok ? weeksResult.error.message : null) ??
    (!playersResult.ok ? playersResult.error.message : null);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
        GPS Load Planner
      </h1>
      {loadError && (
        <p className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {loadError}
        </p>
      )}
      <GpsLoadPlannerView initialWeeks={weeks} players={players} />
    </div>
  );
}
