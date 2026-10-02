import Link from "next/link";
import { redirect } from "next/navigation";
import { HiitSpeedsForm } from "./HiitSpeedsForm";
import { getAppUser } from "@/lib/auth";
import { loadHiitSpeedRows } from "@/lib/hiit/load.server";

export default async function HiitPlayersPage() {
  const user = await getAppUser();
  if (!user) redirect("/login");
  if (user.role !== "admin" && user.role !== "staff") redirect("/dashboard");

  const rows = await loadHiitSpeedRows();

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">HIIT players</h1>
          <p className="mt-1 text-sm text-zinc-400">
            MAS and MSS in km/h. ASR is MSS minus MAS. The sheet uses these saved numbers.
          </p>
        </div>
        <Link href="/hiit" className="inline-flex h-11 items-center rounded-lg border border-white/15 px-4 text-sm">
          Open sheet
        </Link>
      </div>
      <HiitSpeedsForm initialRows={rows} />
    </div>
  );
}
