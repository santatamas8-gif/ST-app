import Link from "next/link";
import { getDailyPlanForPrintAction } from "@/app/actions/gpsPlanner";
import { getPublicTeamLogo } from "@/app/actions/teamSettings";
import { isPlannerUuid } from "@/lib/gpsPlanner/common";
import { plannerErrorMessage } from "@/lib/gpsPlanner/uiDisplay";
import { DailyPlanPrintView } from "./DailyPlanPrintView";

export const dynamic = "force-dynamic";

function parsePlayerIds(raw: string | string[] | undefined): string[] {
  const value = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default async function DailyPlanPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ weekDayId?: string; playerIds?: string | string[] }>;
}) {
  const params = await searchParams;
  const weekDayId = (params.weekDayId ?? "").trim();
  const playerIds = parsePlayerIds(params.playerIds);

  if (!weekDayId || !isPlannerUuid(weekDayId) || playerIds.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-sm text-zinc-700">
        <p className="font-medium text-zinc-900">Missing print parameters</p>
        <p className="mt-2 text-zinc-600">
          Provide <code className="text-xs">weekDayId</code> and comma-separated{" "}
          <code className="text-xs">playerIds</code> query params.
        </p>
        <Link
          href="/admin/planner"
          className="mt-4 inline-block text-emerald-700 hover:underline"
        >
          ← Back to planner
        </Link>
      </div>
    );
  }

  const [result, { team_logo_url }] = await Promise.all([
    getDailyPlanForPrintAction({ weekDayId, playerIds }),
    getPublicTeamLogo(),
  ]);

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-sm text-zinc-700">
        <p className="font-medium text-zinc-900">Could not load Daily Plan</p>
        <p className="mt-2 text-zinc-600">
          {plannerErrorMessage(result.error.code, result.error.message)}
        </p>
        <Link
          href="/admin/planner"
          className="mt-4 inline-block text-emerald-700 hover:underline"
        >
          ← Back to planner
        </Link>
      </div>
    );
  }

  return (
    <DailyPlanPrintView data={result.data} logoUrl={team_logo_url} />
  );
}
