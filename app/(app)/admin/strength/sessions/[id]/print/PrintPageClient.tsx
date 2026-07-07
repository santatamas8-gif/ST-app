"use client";

import Link from "next/link";
import { StrengthCardPrint } from "@/components/strength/StrengthCardPrint";
import type { PlayerStrengthCard } from "@/lib/strength/types";

export function PrintPageClient({ cards }: { cards: PlayerStrengthCard[] }) {
  return (
    <>
      <div className="strength-print-toolbar no-print">
        <Link
          href={`/admin/strength/sessions/${cards[0]?.session_id}`}
          className="text-sm text-zinc-600 hover:text-zinc-900"
        >
          ← Back to session
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Print
        </button>
      </div>
      <StrengthCardPrint cards={cards} />
    </>
  );
}
