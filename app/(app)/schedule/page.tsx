import { getAppUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SchedulePageContent } from "./SchedulePageContent";

export default async function SchedulePage() {
  const user = await getAppUser();
  if (!user) redirect("/login");

  const isPlayer = user.role === "player";
  const canEdit = user.role === "admin" || user.role === "staff";
  const isAdmin = user.role === "admin";

  return (
    <div
      className={isPlayer ? "min-h-screen px-4 py-8 sm:px-6 lg:px-8" : "space-y-6"}
      style={isPlayer ? { backgroundColor: "var(--page-bg)" } : undefined}
    >
      <SchedulePageContent canEdit={canEdit} isAdmin={isAdmin} isPlayer={isPlayer} />
    </div>
  );
}
