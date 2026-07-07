"use client";

import { useState } from "react";
import Link from "next/link";
import { importFromExcel } from "@/app/actions/strength";
import { ExerciseImageEditor } from "@/components/strength/ExerciseImageEditor";
import type { StrengthExercise } from "@/lib/strength/types";

export function ExercisesAdminView({ exercises }: { exercises: StrengthExercise[] }) {
  const [list, setList] = useState(exercises);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin/strength" className="text-sm text-zinc-400 hover:text-white">
            ← Strength Cards
          </Link>
          <h1 className="mt-2 text-xl font-bold text-white sm:text-2xl">Exercise Database</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Drag and drop an image onto each exercise, or use the file picker.
          </p>
        </div>
      </div>

      <form onSubmit={handleImport} className="rounded-xl border border-zinc-700/50 bg-zinc-900/40 p-4">
        <p className="mb-3 text-sm text-zinc-400">
          Import from Strength-Card-Builder-Aleksa.xlsm (Exercises sheet)
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            name="file"
            accept=".xlsm,.xlsx,.xls"
            className="text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-2 file:text-sm file:text-white"
            required
          />
          <button
            type="submit"
            disabled={importing}
            className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {importing ? "Importing…" : "Import Excel"}
          </button>
        </div>
      </form>

      {message && <p className="text-sm text-amber-400">{message}</p>}

      <div className="space-y-3">
        {list.map((ex) => (
          <div
            key={ex.id}
            className="flex flex-col gap-4 rounded-xl border border-zinc-700/50 bg-zinc-900/40 p-4 sm:flex-row sm:items-start"
          >
            <ExerciseImageEditor
              exerciseId={ex.id}
              exerciseName={ex.name}
              imageUrl={ex.image_url}
              onImageChange={(url) => handleImageChange(ex.id, url)}
              onError={setMessage}
            />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-white">{ex.name}</h3>
              <p className="mt-1 text-xs text-zinc-500">
                {ex.category} · {ex.related_to} · coef {ex.percent} · round {ex.rounding}
                {ex.percent_bw_used > 0 ? ` · BW ${ex.percent_bw_used * 100}%` : ""}
              </p>
              {ex.note && <p className="mt-1 text-xs text-zinc-400">{ex.note}</p>}
              {ex.video_url && (
                <a
                  href={ex.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-emerald-400 hover:text-emerald-300"
                >
                  Video
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
