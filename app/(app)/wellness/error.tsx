"use client";

import { useEffect } from "react";

const CARD_RADIUS = "12px";

export default function WellnessError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Wellness page error:", error);
  }, [error]);

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ backgroundColor: "var(--page-bg)" }}
    >
      <div className="mx-auto max-w-md">
        <div
          className="rounded-xl border border-red-900/50 bg-red-950/20 p-6"
          style={{ backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }}
        >
          <h2 className="text-lg font-semibold text-red-400">Something went wrong</h2>
          <p className="mt-2 text-sm text-zinc-400">
            We couldn’t load the wellness page. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}
