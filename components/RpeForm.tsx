"use client";

import { useState } from "react";
import { submitSession } from "@/app/actions/sessions";
import { Card } from "@/components/Card";
import { ScaleInput } from "@/components/ScaleInput";
import { sessionLoad } from "@/utils/load";

const today = new Date().toISOString().slice(0, 10);

export function RpeForm() {
  const [date, setDate] = useState(today);
  const [duration, setDuration] = useState("");
  const [rpe, setRpe] = useState(5);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const durationNum = duration ? parseInt(duration, 10) : 0;
  const load = durationNum > 0 && rpe >= 1 ? sessionLoad(durationNum, rpe) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!durationNum || durationNum < 1) {
      setMessage({ type: "error", text: "Duration must be at least 1 minute." });
      return;
    }
    setLoading(true);
    const result = await submitSession({ date, duration: durationNum, rpe });
    setLoading(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "success", text: "Session saved." });
  }

  return (
    <Card title="Log session (RPE)">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-zinc-300">
            Date
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1.5 block w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label htmlFor="duration" className="block text-sm font-medium text-zinc-300">
            Session duration (minutes)
          </label>
          <input
            id="duration"
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required
            placeholder="e.g. 45"
            className="mt-1.5 block w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <ScaleInput label="Session RPE (1–10)" value={rpe} onChange={setRpe} />

        {load != null && (
          <p className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-300">
            Load = Duration × RPE: <strong className="text-white">{load}</strong>
          </p>
        )}

        {message && (
          <p
            className={
              message.type === "error"
                ? "rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400"
                : "rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400"
            }
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save session"}
        </button>
      </form>
    </Card>
  );
}
