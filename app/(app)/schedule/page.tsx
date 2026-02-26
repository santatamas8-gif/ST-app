import { getAppUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ScheduleCalendar } from "@/components/ScheduleCalendar";

export default async function SchedulePage() {
  const user = await getAppUser();
  if (!user) redirect("/login");

  const isPlayer = user.role === "player";

  return (
    <div
      className={isPlayer ? "min-h-screen px-4 py-8 sm:px-6 lg:px-8" : "space-y-6"}
      style={isPlayer ? { backgroundColor: "var(--page-bg)" } : undefined}
    >
      <div className={isPlayer ? "mx-auto max-w-4xl space-y-6" : ""}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Schedule</h1>
          <p className="mt-1 text-zinc-400">
            Daily program (breakfast, lunch, dinner, training, gym, recovery, pre-activation).
            {user.role === "admin" || user.role === "staff"
              ? " Click a day to add or remove items."
              : " View the program for each day."}
          </p>
        </div>
        <ScheduleCalendar
          canEdit={user.role === "admin" || user.role === "staff"}
          isAdmin={user.role === "admin"}
        />
      </div>
    </div>
  );
}
