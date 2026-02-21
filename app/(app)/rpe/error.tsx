"use client";

import { useEffect } from "react";

const BG_CARD = "#11161c";
const CARD_RADIUS = "12px";

export default function RpeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("RPE page error:", error);
  }, [error]);

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ backgroundColor: "#0b0f14" }}
    >
      <div className="mx-auto max-w-md">
        <div
          className="rounded-xl border border-red-900/50 bg-red-950/20 p-6"
          style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
        >
          <h2 className="text-lg font-semibold text-red-400">Hiba történt</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Az RPE oldal betöltése sikertelen. Próbáld újra.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Újrapróbálás
          </button>
        </div>
      </div>
    </div>
  );
}
