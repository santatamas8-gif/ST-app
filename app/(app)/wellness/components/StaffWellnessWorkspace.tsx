"use client";

import { useState } from "react";
import { MobileWellnessList } from "@/components/mobile/MobileWellnessList";
import type { MatchFeedbackListItem, MatchFeedbackMatch, MatchFeedbackResponse } from "@/lib/matchFeedback/types";
import type { KioskPlayer } from "@/lib/players/listPlayers";
import type { WellnessRow } from "@/lib/types";
import { MatchFeedbackResultsView } from "./MatchFeedbackResultsView";
import { StaffWellnessView } from "./StaffWellnessView";

type MatchDetailState = {
  match: MatchFeedbackMatch;
  participants: KioskPlayer[];
  responsesByPlayerId: Record<string, MatchFeedbackResponse>;
};

type StaffWellnessWorkspaceProps = {
  list: WellnessRow[];
  emailByUserId: Record<string, string>;
  displayNameByUserId: Record<string, string>;
  avatarByUserId: Record<string, string | null>;
  totalPlayers: number | null;
  allPlayerIds: string[];
  matchList: MatchFeedbackListItem[];
  matchDetailsById: Record<string, MatchDetailState>;
  canDeleteMatch?: boolean;
};

type WellnessStaffMode = "daily" | "match";

/**
 * Thin wrapper: Daily keeps existing StaffWellnessView / MobileWellnessList unchanged.
 * Match renders a sibling results view only.
 */
export function StaffWellnessWorkspace({
  list,
  emailByUserId,
  displayNameByUserId,
  avatarByUserId,
  totalPlayers,
  allPlayerIds,
  matchList,
  matchDetailsById,
  canDeleteMatch = false,
}: StaffWellnessWorkspaceProps) {
  const [mode, setMode] = useState<WellnessStaffMode>("daily");

  return (
    <div className="space-y-4">
      <div
        className="mx-auto flex w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/60 p-1 md:mx-0"
        role="tablist"
        aria-label="Wellness results view"
      >
        {(
          [
            { id: "daily" as const, label: "Daily" },
            { id: "match" as const, label: "Match" },
          ] as const
        ).map(({ id, label }) => {
          const selected = mode === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setMode(id)}
              className={`min-h-[44px] flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                selected
                  ? "bg-emerald-600 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {mode === "daily" ? (
        <>
          <div className="md:hidden">
            <MobileWellnessList
              list={list}
              emailByUserId={emailByUserId}
              displayNameByUserId={displayNameByUserId}
              avatarByUserId={avatarByUserId}
              totalPlayers={totalPlayers}
              allPlayerIds={allPlayerIds}
            />
          </div>
          <div className="hidden md:block">
            <StaffWellnessView
              list={list}
              emailByUserId={emailByUserId}
              displayNameByUserId={displayNameByUserId}
              avatarByUserId={avatarByUserId}
              totalPlayers={totalPlayers}
              allPlayerIds={allPlayerIds}
            />
          </div>
        </>
      ) : (
        <div className="px-4 pb-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <h1 className="mb-4 text-lg font-bold tracking-tight text-white sm:text-xl">
              Match Feedback
            </h1>
            <MatchFeedbackResultsView
              matches={matchList}
              detailsByMatchId={matchDetailsById}
              canDeleteMatch={canDeleteMatch}
            />
          </div>
        </div>
      )}
    </div>
  );
}
