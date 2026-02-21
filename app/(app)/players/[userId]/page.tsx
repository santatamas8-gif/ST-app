import { getAppUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { getPlayerDetail } from "@/lib/playerDetail";
import { getAvailability } from "@/app/actions/availability";
import { AvailabilityPerDay } from "./AvailabilityPerDay";
import type { WellnessRow } from "@/lib/types";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await getAppUser();
  if (!user) return null;

  const { error, playerEmail, wellness, sessions, from, to } = await getPlayerDetail(
    userId,
    user.id,
    user.role
  );
  if (error || !playerEmail) notFound();

  const { data: availabilityList } = await getAvailability(userId, from!, to!);
  const availabilityByDate = new Map(availabilityList.map((a) => [a.date, a.status]));

  const wellnessByDate = new Map<string, WellnessRow>();
  wellness.forEach((r) => wellnessByDate.set(r.date, r));
  const loadByDate = new Map<string, number>();
  sessions.forEach((s) => {
    loadByDate.set(s.date, (loadByDate.get(s.date) ?? 0) + (s.load ?? 0));
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
      <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
        ← Dashboard
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-white">{playerEmail}</h1>
      <p className="text-zinc-400">Trend (last 14 days) and daily availability.</p>

      <Card title="Trend">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-700 text-zinc-400">
                <th className="pb-2 pr-4 font-medium">Date</th>
                <th className="pb-2 pr-4 font-medium">Sleep (h)</th>
                <th className="pb-2 pr-4 font-medium">Quality</th>
                <th className="pb-2 pr-4 font-medium">Fatigue</th>
                <th className="pb-2 pr-4 font-medium">Mood</th>
                <th className="pb-2 font-medium">Load</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {dates.map((date) => {
                const w = wellnessByDate.get(date);
                const load = loadByDate.get(date) ?? 0;
                return (
                  <tr key={date} className="border-b border-zinc-800">
                    <td className="py-2 pr-4">{date}</td>
                    <td className="py-2 pr-4">{w?.sleep_duration != null ? `${w.sleep_duration}h` : "—"}</td>
                    <td className="py-2 pr-4">{w?.sleep_quality ?? "—"}</td>
                    <td className="py-2 pr-4">{w?.fatigue ?? "—"}</td>
                    <td className="py-2 pr-4">{w?.mood ?? "—"}</td>
                    <td className="py-2">{load || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

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
