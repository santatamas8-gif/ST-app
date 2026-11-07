import { redirect } from "next/navigation";
import { getPublicTeamLogo } from "@/app/actions/teamSettings";
import { DrillAnalysisView } from "@/app/(app)/drill-analysis/DrillAnalysisView";
import { requireDrillAnalysisStaff } from "@/lib/drillAnalysis/access.server";
import { loadDrillAnalysisPage } from "@/lib/drillAnalysis/load.server";
import { loadPlayerPhotoMap } from "@/lib/drillAnalysis/playerPhotos.server";

export const dynamic = "force-dynamic";

export default async function DrillAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; session?: string; player?: string }>;
}) {
  const access = await requireDrillAnalysisStaff();
  if (!access.ok) redirect(access.status === 401 ? "/login" : "/dashboard");

  const params = await searchParams;
  const [data, logo, playerPhotos] = await Promise.all([
    loadDrillAnalysisPage({
      date: params.date,
      sessionKey: params.session,
      player: params.player,
    }),
    getPublicTeamLogo(),
    loadPlayerPhotoMap(),
  ]);

  return (
    <div className="da-print-root -mx-4 bg-white px-4 py-4 text-zinc-900 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <DrillAnalysisView data={data} logoUrl={logo.team_logo_url} playerPhotos={playerPhotos} />
    </div>
  );
}
