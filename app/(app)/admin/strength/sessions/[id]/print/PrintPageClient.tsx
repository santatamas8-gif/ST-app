"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { StrengthCardPrint } from "@/components/strength/StrengthCardPrint";
import type { PlayerStrengthCard } from "@/lib/strength/types";

export function PrintPageClient({
  cards,
  teamLogoUrl,
}: {
  cards: PlayerStrengthCard[];
  teamLogoUrl?: string | null;
}) {
  const sessionId = cards[0]?.session_id ?? "";

  return (
    <>
      <div className="strength-print-toolbar no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/admin/strength/sessions/${sessionId}`}
            className="text-sm text-zinc-600 hover:text-zinc-900"
          >
            ← Back to session
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={cards.length === 0}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="h-4 w-4" aria-hidden />
            Print
          </button>
        </div>
      </div>

      {cards.length > 0 ? (
        <StrengthCardPrint cards={cards} teamLogoUrl={teamLogoUrl} />
      ) : (
        <div className="no-print mx-auto w-[210mm] max-w-[calc(100vw-32px)] rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-500">
          No player cards to print.
        </div>
      )}
    </>
  );
}
