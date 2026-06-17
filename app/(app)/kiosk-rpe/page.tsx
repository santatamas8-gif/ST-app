import { getAppUser } from "@/lib/auth";
import { listPlayersForKiosk } from "@/lib/players/listPlayers";
import { createClient } from "@/lib/supabase/server";
import { runQuery } from "@/lib/supabase/safeQuery";
import { redirect } from "next/navigation";
import { KioskRpeView } from "./components/KioskRpeView";

export default async function KioskRpePage() {
  const user = await getAppUser();
  if (!user) redirect("/login");
  if (user.role !== "admin" && user.role !== "staff") redirect("/dashboard");

  const supabase = await createClient();
  const { data: players, error: loadError } = await runQuery("kiosk-rpe-players", () =>
    listPlayersForKiosk(supabase)
  );

  return <KioskRpeView players={players ?? []} loadError={loadError} />;
}
