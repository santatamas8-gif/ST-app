import { getAppUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { getPlayerDetail } from "@/lib/playerDetail";
import { getAvailability } from "@/app/actions/availability";
import { AvailabilityPerDay } from "./AvailabilityPerDay";
import { PlayerWellnessTrend } from "./PlayerWellnessTrend";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await getAppUser();
  if (!user) return null;

  const { error, playerEmail, displayName, wellness, sessions, from, to } = await getPlayerDetail(
    userId,
    user.id,
    user.role
  );
  if (error || !playerEmail) notFound();

  const { data: availabilityList } = await getAvailability(userId, from!, to!);
  const availabilityByDate = new Map(availabilityList.map((a) => [a.date, a.status]));

  const loadByDate: Record<string, number> = {};
  sessions.forEach((s) => {
    loadByDate[s.date] = (loadByDate[s.date] ?? 0) + (s.load ?? 0);
  });

  const dates: string[] = [];
  const d = new Date(from!);
  const end = new Date(to!);
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  dates.reverse();

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <Link href="/wellness" className="text-sm text-zinc-400 hover:text-white">
        ← Wellness
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-white">{displayName}</h1>
      <p className="text-zinc-400">Trend (last 28 days): 7-day and 28-day averages and daily bars.</p>

      <PlayerWellnessTrend wellness={wellness} dates={dates} loadByDate={loadByDate} />

      {(user.role === "admin" || user.role === "staff") && (
        <Card title="Availability (by day)">
          <p className="mb-4 text-sm text-zinc-400">
            Set each day: Available, Injured, or Unavailable.
          </p>
          <AvailabilityPerDay
            userId={userId}
            dates={dates}
            initialByDate={Object.fromEntries(availabilityByDate)}
          />
        </Card>
      )}
    </div>
  );
}
