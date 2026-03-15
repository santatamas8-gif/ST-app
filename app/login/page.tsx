import { getPublicTeamLogo } from "@/app/actions/teamSettings";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const { team_logo_url } = await getPublicTeamLogo();
  return <LoginForm teamLogoUrl={team_logo_url} />;
}
