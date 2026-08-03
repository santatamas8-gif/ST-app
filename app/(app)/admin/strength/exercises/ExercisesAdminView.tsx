"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, Search } from "lucide-react";
import { importFromExcel } from "@/app/actions/strength";
import { ExerciseImageEditor } from "@/components/strength/ExerciseImageEditor";
import type { StrengthExercise } from "@/lib/strength/types";

export function ExercisesAdminView({ exercises }: { exercises: StrengthExercise[] }) {
  const [list, setList] = useState(exercises);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredExercises = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((ex) => {
      const name = ex.name.toLowerCase();
      const category = ex.category.toLowerCase();
      const related = ex.related_to.toLowerCase();
      return name.includes(q) || category.includes(q) || related.includes(q);
    });
  }, [list, search]);

  async function handleImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setImporting(true);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    const result = await importFromExcel(form);
    setImporting(false);
    if (result.error) setMessage(result.error);
    else {
      setMessage(`Imported ${result.exerciseCount} exercises, ${result.schemeCount} schemes`);
      window.location.reload();
    }
  }

  function handleImageChange(exerciseId: string, url: string | null) {
    setList((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, image_url: url } : ex))
    );
    setMessage(null);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7 md:max-w-6xl lg:max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/admin/strength"
            className="text-sm font-medium text-zinc-500 transition hover:text-emerald-400"
          >
            ← Strength Cards
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Exercise Database
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-400">
            Drag and drop an image onto each exercise, or use the file picker.
          </p>
        </div>
        <div className="shrink-0 self-start rounded-2xl border border-zinc-700/60 bg-gradient-to-br from-zinc-900/90 to-zinc-950/80 px-4 py-3 shadow-[0_0_24px_-8px_rgba(16,185,129,0.25)] sm:mt-8">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Total Exercises
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-white">{list.length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/50 p-4 shadow-lg shadow-black/20 sm:p-5">
        <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Search exercise
          <div className="relative mt-2.5">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, category, or related lift…"
              className="min-h-[48px] w-full rounded-xl border border-zinc-700/80 bg-zinc-950/60 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-emerald-600/60 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </label>
        <p className="mt-3 text-xs text-zinc-500">
          Showing{" "}
          <span className="font-medium text-zinc-300">{filteredExercises.length}</span>
          {" / "}
          <span className="font-medium text-zinc-300">{list.length}</span> exercises
        </p>
      </div>

      <form
        onSubmit={handleImport}
        className="rounded-2xl border border-zinc-700/50 bg-gradient-to-br from-zinc-900/80 to-zinc-950/70 p-4 shadow-lg shadow-black/20 sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-800/40 bg-emerald-950/40 text-emerald-400">
              <FileSpreadsheet className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white">Import Excel</p>
              <p className="mt-0.5 text-sm leading-snug text-zinc-400">
                Import from Strength-Card-Builder-Aleksa.xlsm (Exercises sheet)
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <input
              type="file"
              name="file"
              accept=".xlsm,.xlsx,.xls"
              className="min-w-0 flex-1 text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-zinc-200 hover:file:bg-zinc-700"
              required
            />
            <button
              type="submit"
              disabled={importing}
              className="min-h-[44px] shrink-0 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_-6px_rgba(16,185,129,0.55)] transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {importing ? "Importing…" : "Import Excel"}
            </button>
          </div>
        </div>
      </form>

      {message && (
        <p className="rounded-xl border border-amber-800/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
          {message}
        </p>
      )}

      {/* Mobile: single-column list. Tablet/desktop: 3+ card grid. */}
      <div className="space-y-3 md:grid md:grid-cols-3 md:gap-4 md:space-y-0 xl:grid-cols-4 xl:gap-5">
        {filteredExercises.map((ex) => (
          <div
            key={ex.id}
            className="group flex flex-col gap-4 rounded-2xl border border-zinc-700/50 bg-gradient-to-b from-zinc-900/90 to-zinc-950/80 p-4 shadow-lg shadow-black/25 transition hover:border-zinc-600/70 hover:shadow-[0_0_28px_-12px_rgba(16,185,129,0.35)] sm:flex-row sm:items-start md:h-full md:flex-col md:items-stretch md:gap-3.5"
          >
            <ExerciseImageEditor
              exerciseId={ex.id}
              exerciseName={ex.name}
              imageUrl={ex.image_url}
              onImageChange={(url) => handleImageChange(ex.id, url)}
              onError={setMessage}
            />
            <div className="min-w-0 flex-1 space-y-2 md:flex-none">
              <h3 className="font-semibold leading-snug tracking-tight text-white md:line-clamp-2 md:text-sm lg:text-[15px]">
                {ex.name}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {ex.category ? (
                  <span className="inline-flex rounded-md border border-zinc-700/80 bg-zinc-800/60 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                    {ex.category}
                  </span>
                ) : null}
                {ex.related_to ? (
                  <span className="inline-flex rounded-md border border-emerald-900/50 bg-emerald-950/35 px-2 py-0.5 text-[11px] font-medium text-emerald-300/90">
                    {ex.related_to}
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-500 md:line-clamp-2">
                coef {ex.percent} · round {ex.rounding}
                {ex.percent_bw_used > 0 ? ` · BW ${ex.percent_bw_used * 100}%` : ""}
              </p>
              {ex.note && (
                <p className="text-xs leading-snug text-zinc-400 md:line-clamp-2">{ex.note}</p>
              )}
              {ex.video_url && (
                <a
                  href={ex.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg border border-emerald-800/40 bg-emerald-950/30 px-2.5 py-1 text-xs font-medium text-emerald-400 transition hover:border-emerald-600/50 hover:bg-emerald-950/50 hover:text-emerald-300"
                >
                  Video
                </a>
              )}
            </div>
          </div>
        ))}
        {filteredExercises.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-700/60 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400 md:col-span-3 xl:col-span-4">
            No exercises match this search.
          </div>
        )}
      </div>
    </div>
  );
}
