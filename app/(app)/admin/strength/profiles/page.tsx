import { getPlayersWithProfiles } from "@/app/actions/strength";
import { ProfilesAdminView } from "./ProfilesAdminView";

export default async function StrengthProfilesPage() {
  const players = await getPlayersWithProfiles();
  return <ProfilesAdminView players={players} />;
}
