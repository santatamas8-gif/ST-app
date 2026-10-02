import { redirect } from "next/navigation";
import { HiitSheet } from "./HiitSheet";
import { getAppUser } from "@/lib/auth";
import { loadHiitPlayersWithSpeed, loadHiitSession, loadHiitSessionList } from "@/lib/hiit/load.server";
import { emptySession } from "@/lib/hiit/session";
import { getPublicTeamLogo } from "@/app/actions/teamSettings";

export default async function HiitPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const user = await getAppUser();
  if (!user) redirect("/login");
  if (user.role !== "admin" && user.role !== "staff") redirect("/dashboard");

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const [players, sessions, loaded, logo] = await Promise.all([
    loadHiitPlayersWithSpeed(),
    loadHiitSessionList(),
    params.session ? loadHiitSession(params.session) : Promise.resolve(null),
    getPublicTeamLogo(),
  ]);

  return (
    <div className="-mx-4 space-y-4 bg-white px-4 py-4 text-zinc-900 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <HiitSheet initial={loaded ?? emptySession(today)} players={players} sessions={sessions} logoUrl={logo.team_logo_url} />
    </div>
  );
}
