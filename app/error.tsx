"use client";

import { useEffect } from "react";

const BG = "#0b0f14";
const CARD = "#11161c";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const errorId = typeof error.digest === "string" ? error.digest : null;
  const timestamp = new Date().toISOString();

  useEffect(() => {
    console.error("App error:", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: BG }}>
      <div className="mx-auto max-w-md">
        <div
          className="rounded-xl border border-red-900/50 bg-red-950/20 p-6"
          style={{ backgroundColor: CARD, borderRadius: 12 }}
        >
          <h1 className="text-lg font-semibold text-red-400">Something went wrong</h1>
          <p className="mt-2 text-sm text-zinc-400">
            An unexpected error occurred. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Try again
          </button>
          {(errorId || timestamp) && (
            <p className="mt-4 text-xs text-zinc-500">
              Error ID: {errorId ?? "—"} · {timestamp}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
