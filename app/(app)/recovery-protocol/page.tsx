import { getAppUser } from "@/lib/auth";
import { getTeamSettings } from "@/app/actions/teamSettings";
import { redirect } from "next/navigation";
import { RecoveryProtocolContent } from "./components/RecoveryProtocolContent";

export default async function RecoveryProtocolPage() {
  const user = await getAppUser();
  if (!user) redirect("/login");

  const teamSettings = await getTeamSettings();

  return (
    <div className="-mx-4 min-w-0 sm:mx-0" style={{ backgroundColor: "var(--page-bg)" }}>
      <RecoveryProtocolContent teamLogoUrl={teamSettings.team_logo_url} />
    </div>
  );
}
