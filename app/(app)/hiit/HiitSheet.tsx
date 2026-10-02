"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteHiitSession, saveHiitSession } from "@/app/actions/hiit";
import { HIIT_CATALOG, catalogRowForWorkRest, formatBand } from "@/lib/hiit/catalog";
import { calcPlayerRow, round0, type HiitPlayerSpeed } from "@/lib/hiit/calc";
import type { HiitSessionListItem } from "@/lib/hiit/load.server";
import { applyCatalogRow, type HiitGroupDraft, type HiitSessionDraft } from "@/lib/hiit/session";

const GROUP_LABELS = ["Group 1", "Group 2", "Group 3"] as const;
const GROUP_COLORS = ["border-emerald-500/60", "border-amber-400/60", "border-red-500/60"] as const;

type Props = {
  initial: HiitSessionDraft;
  players: HiitPlayerSpeed[];
  sessions: HiitSessionListItem[];
  logoUrl?: string | null;
};

export function HiitSheet({ initial, players, sessions, logoUrl }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const byId = useMemo(() => new Map(players.map((player) => [player.playerId, player])), [players]);

  function patchGroup(index: number, patch: Partial<HiitGroupDraft>) {
    setDraft((current) => {
      const groups = [...current.groups] as HiitSessionDraft["groups"];
      groups[index] = { ...groups[index], ...patch };
      return { ...current, groups };
    });
  }

  function setGroupPlayers(index: number, playerIds: string[]) {
    setDraft((current) => {
      const taken = new Set(playerIds);
      const groups = current.groups.map((group, groupIndex) => ({
        ...group,
        playerIds: groupIndex === index ? playerIds : group.playerIds.filter((id) => !taken.has(id)),
      })) as HiitSessionDraft["groups"];
      return { ...current, groups };
    });
  }

  function togglePlayer(index: number, playerId: string) {
    setDraft((current) => {
      const groups = current.groups.map((group) => ({
        ...group,
        playerIds: group.playerIds.filter((id) => id !== playerId),
      })) as HiitSessionDraft["groups"];
      const selected = current.groups[index].playerIds.includes(playerId);
      if (!selected) groups[index] = { ...groups[index], playerIds: [...groups[index].playerIds, playerId] };
      return { ...current, groups };
    });
  }

  async function onSave() {
    setPending(true);
    setMessage(null);
    const result = await saveHiitSession({
      ...draft,
      groups: draft.groups.map((group) => ({
        ...group,
        format: group.shuttleCount >= 2 ? "shuttle" : "interval",
        shuttleCount: group.shuttleCount >= 2 ? group.shuttleCount : 1,
      })) as HiitSessionDraft["groups"],
    });
    setPending(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage("Saved.");
    if (result.id && result.id !== draft.id) {
      router.replace(`/hiit?session=${result.id}`);
    } else {
      router.refresh();
    }
  }

  async function onDelete() {
    if (!draft.id) return;
    setPending(true);
    const result = await deleteHiitSession(draft.id);
    setPending(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    router.replace("/hiit");
    router.refresh();
  }

  return (
    <div className="hiit-sheet space-y-4 bg-white text-zinc-900">
      <style>{`
        .hiit-select-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 0, 0, 0.35) transparent;
        }
        .hiit-select-scroll::-webkit-scrollbar { width: 4px; }
        .hiit-select-scroll::-webkit-scrollbar-track { background: transparent; }
        .hiit-select-scroll::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.35); border-radius: 999px; }
        .hiit-select-scroll::-webkit-scrollbar-button { display: none; height: 0; width: 0; }
        @media print {
          html, body, .hiit-sheet, .hiit-sheet * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body, body > div, main {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #18181b !important;
          }
          .hiit-screen-only { display: none !important; }
          .hiit-sheet { zoom: 0.72; }
          .hiit-select-scroll { scrollbar-width: none !important; }
          .hiit-select-scroll::-webkit-scrollbar { display: none !important; }
          .hiit-logo { background: transparent !important; box-shadow: none !important; }
          .hiit-groups { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 12px !important; align-items: stretch !important; break-inside: auto !important; page-break-inside: auto !important; }
          .hiit-col { display: grid !important; grid-template-rows: subgrid !important; grid-row: span 4 !important; break-inside: auto !important; page-break-inside: auto !important; }
          .hiit-sheet input, .hiit-sheet select {
            background: #ffffff !important;
            color: #18181b !important;
            border: 1px solid #d4d4d8 !important;
          }
          @page { size: A4 landscape; margin: 5mm; }
        }
      `}</style>

      <div className="hiit-screen-only flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-zinc-900">Saved sheet</span>
          <select
            className="h-11 min-w-48 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900"
            value={draft.id ?? ""}
            onChange={(event) => {
              const id = event.target.value;
              router.push(id ? `/hiit?session=${id}` : "/hiit");
            }}
          >
            <option value="">New sheet</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.sessionDate} · {session.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-900">Name</span>
          <input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            className="h-11 w-40 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-900">Date</span>
          <input
            type="date"
            value={draft.sessionDate}
            onChange={(event) => setDraft({ ...draft, sessionDate: event.target.value })}
            className="h-11 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900"
          />
        </label>
        <button type="button" onClick={onSave} disabled={pending} className="h-11 rounded-lg bg-emerald-500 px-4 font-medium text-black disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => window.print()} className="h-11 rounded-lg border border-zinc-300 px-4">
          Print
        </button>
        <Link href="/hiit/players" className="ml-auto inline-flex h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm text-zinc-900">
          Player speeds
        </Link>
        {draft.id ? (
          <button type="button" onClick={onDelete} disabled={pending} className="h-11 rounded-lg border border-red-500/40 px-4 text-red-700">
            Delete
          </button>
        ) : null}
        {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
      </div>

      <p className="hiit-screen-only text-sm text-zinc-900">{draft.sessionDate} · Rest is standing only</p>

      <div>
        <div className="relative mb-3 min-h-12">
          <h2 className="px-14 text-center text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">HIIT BUILDER</h2>
          {logoUrl?.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl.trim()}
              alt="Team logo"
              referrerPolicy="no-referrer"
              className="hiit-logo absolute right-0 top-1/2 h-12 w-12 -translate-y-1/2 bg-transparent object-contain"
            />
          ) : null}
        </div>
        <div className="hiit-groups grid items-start gap-4 xl:grid-cols-3 xl:items-stretch">
        {draft.groups.map((group, index) => (
          <GroupCard
            key={GROUP_LABELS[index]}
            index={index}
            group={group}
            players={players}
            byId={byId}
            onPatch={(patch) => patchGroup(index, patch)}
            onToggle={(playerId) => togglePlayer(index, playerId)}
            onSetPlayers={(playerIds) => setGroupPlayers(index, playerIds)}
          />
        ))}
        </div>
        <p className="mt-2 text-right text-[10px] italic text-zinc-500">created by Santa Tamas</p>
      </div>
    </div>
  );
}

const fieldClass = "mt-0.5 h-6 w-full rounded border border-zinc-300 bg-white px-1 text-[10px] text-zinc-900";

function GroupCard({
  index,
  group,
  players,
  byId,
  onPatch,
  onToggle,
  onSetPlayers,
}: {
  index: number;
  group: HiitGroupDraft;
  players: HiitPlayerSpeed[];
  byId: Map<string, HiitPlayerSpeed>;
  onPatch: (patch: Partial<HiitGroupDraft>) => void;
  onToggle: (playerId: string) => void;
  onSetPlayers: (playerIds: string[]) => void;
}) {
  const running = group.shuttleCount >= 2 ? { ...group, format: "shuttle" as const } : { ...group, format: "interval" as const };
  const catalog = catalogRowForWorkRest(running.workSec, running.restSec);
  const band = catalog
    ? running.intensityBasis === "mas"
      ? [catalog.masMin, catalog.masMax]
      : [catalog.asrMin, catalog.asrMax]
    : null;
  const outside = band != null && (running.percent < band[0] || running.percent > band[1]);
  const rows = running.playerIds
    .map((id) => byId.get(id))
    .filter((player): player is HiitPlayerSpeed => Boolean(player))
    .map((player) => calcPlayerRow(player, running))
    .filter((row): row is NonNullable<typeof row> => row != null);
  const allSelected = players.length > 0 && players.every((player) => running.playerIds.includes(player.playerId));

  return (
    <section className={`hiit-col flex flex-col gap-2 rounded-xl border-2 bg-zinc-100 ${GROUP_COLORS[index]} p-2 xl:grid xl:grid-rows-subgrid xl:row-span-4`}>
      <h2 className={`w-fit rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase text-black ${index === 0 ? "bg-emerald-400" : index === 1 ? "bg-amber-400" : "bg-red-500 text-white"}`}>
        {GROUP_LABELS[index]}
      </h2>

      <div className="hiit-top grid grid-cols-4 gap-x-1 gap-y-0.5 text-[9px] leading-none">
        <label>
          Type
          <select
            value={running.intensityBasis}
            onChange={(event) => onPatch({ intensityBasis: event.target.value as HiitGroupDraft["intensityBasis"] })}
            className={fieldClass}
          >
            <option value="mas">MAS</option>
            <option value="asr">ASR</option>
          </select>
        </label>
        <label>
          %
          <input inputMode="decimal" value={running.percent} onChange={(event) => onPatch({ percent: Number(event.target.value) })} className={fieldClass} />
        </label>
        <label>
          Work (s)
          <input inputMode="numeric" value={running.workSec} onChange={(event) => onPatch({ workSec: Number(event.target.value) })} className={fieldClass} />
        </label>
        <label>
          Rest (s)
          <input inputMode="numeric" value={running.restSec} onChange={(event) => onPatch({ restSec: Number(event.target.value) })} className={fieldClass} />
        </label>
        <label>
          Reps
          <input inputMode="numeric" value={running.reps} onChange={(event) => onPatch({ reps: Number(event.target.value) })} className={fieldClass} />
        </label>
        <label>
          Sets
          <input inputMode="numeric" value={running.sets} onChange={(event) => onPatch({ sets: Number(event.target.value) })} className={fieldClass} />
        </label>
        <label>
          Shuttles
          <input
            inputMode="numeric"
            value={running.shuttleCount}
            onChange={(event) => {
              const shuttleCount = Number(event.target.value);
              onPatch({ shuttleCount, format: shuttleCount >= 2 ? "shuttle" : "interval" });
            }}
            className={fieldClass}
          />
        </label>
        <label className={running.format === "shuttle" ? "" : "opacity-40"}>
          Start loss (s)
          <input inputMode="decimal" value={running.startLossSec} disabled={running.format !== "shuttle"} onChange={(event) => onPatch({ startLossSec: Number(event.target.value) })} className={fieldClass} />
        </label>
        <label className={running.format === "shuttle" ? "" : "opacity-40"}>
          COD loss (s)
          <input inputMode="decimal" value={running.codLossSec} disabled={running.format !== "shuttle"} onChange={(event) => onPatch({ codLossSec: Number(event.target.value) })} className={fieldClass} />
        </label>
        <p className={`col-span-4 min-h-4 text-[10px] ${outside ? "text-amber-700" : "invisible"}`}>Outside the recommended band for this work/rest.</p>
      </div>

      <div className="grid grid-cols-[1.35fr_0.9fr] gap-2">
        <div className="overflow-hidden rounded border border-zinc-300">
          <div className="grid grid-cols-[1fr_auto] bg-sky-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
            <span>Name</span>
            <span>Meters</span>
          </div>
          <ul>
            {rows.map((row, rowIndex) => (
              <li
                key={row.playerId}
                className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-zinc-200 px-1.5 py-0.5 text-zinc-900"
                style={{ backgroundColor: rowIndex % 2 === 0 ? "#e7f2f8" : "#f4f4f5" }}
              >
                <span className="hiit-names truncate text-xs font-medium">{row.name}</span>
                <span className="hiit-meters text-sm font-semibold tabular-nums">{round0(row.meters)}</span>
              </li>
            ))}
            {rows.length === 0 ? <li className="px-2 py-2 text-xs text-zinc-500">Tick players on the right.</li> : null}
          </ul>
        </div>
        <div className="hiit-select overflow-hidden rounded border border-zinc-300">
          <div className="bg-sky-700 px-1 py-0.5 text-[9px] font-semibold uppercase text-white">Select athlete</div>
          <label className="flex min-h-6 items-center gap-1 border-b border-zinc-200 px-1 text-[10px]">
            <input
              type="checkbox"
              className="h-2.5 w-2.5"
              checked={allSelected}
              onChange={() => onSetPlayers(allSelected ? [] : players.map((player) => player.playerId))}
            />
            Select all
          </label>
          <div className="hiit-select-scroll max-h-64 space-y-0 overflow-y-auto px-1 py-0.5">
            {players.map((player) => (
              <label key={player.playerId} className="flex min-h-6 items-center gap-1 text-[10px]">
                <input type="checkbox" className="h-2.5 w-2.5" checked={running.playerIds.includes(player.playerId)} onChange={() => onToggle(player.playerId)} />
                <span className="min-w-0 whitespace-normal break-words leading-tight">{player.name}</span>
              </label>
            ))}
            {players.length === 0 ? <p className="py-2 text-xs text-zinc-400">Save MAS and MSS on the players page first.</p> : null}
          </div>
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto rounded-sm border border-zinc-300">
        <table className="hiit-catalog w-full border-collapse text-[10px] font-normal leading-none" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "28%" }} />
            <col style={{ width: "28%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <thead>
            <tr className="bg-[#6b2430] text-white">
              <th className="border border-white/50 px-1 py-0.5 text-center font-normal">Work</th>
              <th className="border border-white/50 px-1 py-0.5 text-center font-normal">Rest</th>
              <th className="border border-white/50 px-1 py-0.5 text-center font-normal">%MAS</th>
              <th className="border border-white/50 px-1 py-0.5 text-center font-normal">%ASR</th>
              <th className="border border-white/50 px-1 py-0.5 text-center font-normal">Reps</th>
              <th className="border border-white/50 px-1 py-0.5 text-center font-normal">Sets</th>
            </tr>
          </thead>
          <tbody>
            {HIIT_CATALOG.map((row, rowIndex) => (
              <tr
                key={`${row.workSec}-${row.restSec}-${rowIndex}`}
                className="cursor-pointer text-zinc-900"
                style={{ backgroundColor: rowIndex % 2 === 0 ? "#ffffff" : "#faf4f5" }}
                onClick={() => onPatch(applyCatalogRow(running, row))}
              >
                <td className="whitespace-nowrap border border-[#b8b8bc] px-1 py-0.5 text-center tabular-nums">{row.workSec}</td>
                <td className="whitespace-nowrap border border-[#b8b8bc] px-1 py-0.5 text-center tabular-nums">{row.restSec}</td>
                <td className="border border-[#b8b8bc] px-1 py-0.5 text-center">
                  <span className="inline-block whitespace-nowrap text-right font-normal tabular-nums" style={{ width: "9ch" }}>{formatBand(row.masMin, row.masMax)}</span>
                </td>
                <td className="border border-[#b8b8bc] px-1 py-0.5 text-center">
                  <span className="inline-block whitespace-nowrap text-right font-normal tabular-nums" style={{ width: "7ch" }}>{formatBand(row.asrMin, row.asrMax, row.asrApprox)}</span>
                </td>
                <td className="border border-[#b8b8bc] px-1 py-0.5 text-center">
                  <span className="inline-block whitespace-nowrap text-right font-normal tabular-nums" style={{ width: "5ch" }}>{row.repsMin}–{row.repsMax}</span>
                </td>
                <td className="whitespace-nowrap border border-[#b8b8bc] px-1 py-0.5 text-center tabular-nums">{row.setsMin}–{row.setsMax}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
