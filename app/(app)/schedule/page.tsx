import { getAppUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ScheduleCalendar } from "@/components/ScheduleCalendar";

export default async function SchedulePage() {
  const user = await getAppUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Schedule</h1>
        <p className="mt-1 text-zinc-400">
          Daily program (breakfast, lunch, dinner, training, gym, recovery, pre-activation).
          {user.role === "admin" || user.role === "staff"
            ? " Click a day to add or remove items."
            : " View the program for each day."}
        </p>
      </div>
      <ScheduleCalendar canEdit={user.role === "admin" || user.role === "staff"} />
    </div>
  );
}
