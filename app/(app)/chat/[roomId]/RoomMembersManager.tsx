"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addRoomMembers, removeRoomMember } from "@/app/actions/chat";

type Member = { user_id: string; email: string; full_name: string | null };
type AvailableUser = { id: string; email: string; full_name: string | null };

export function RoomMembersManager({
  roomId,
  members,
  availableUsers,
  currentUserId,
  subtleOnDesktop = false,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  modal = false,
}: {
  roomId: string;
  members: Member[];
  availableUsers: AvailableUser[];
  currentUserId: string;
  /** When true, use a low-emphasis trigger on md+ (e.g. for chat header). */
  subtleOnDesktop?: boolean;
  /** When provided, control open state externally (e.g. from a menu). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When true, do not render the trigger button (use with controlled open). */
  hideTrigger?: boolean;
  /** When true and open, render dropdown in a fixed overlay (for mobile menu). */
  modal?: boolean;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined && onOpenChange !== undefined;
  const open = isControlled ? controlledOpen! : internalOpen;
  const setOpen = (v: boolean) => (isControlled ? onOpenChange!(v) : setInternalOpen(v));
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  function toggleSelected(userId: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleAdd() {
    const ids = Array.from(selectedUserIds);
    if (ids.length === 0) return;
    setAdding(true);
    const result = await addRoomMembers(roomId, ids);
    setAdding(false);
    setSelectedUserIds(new Set());
    if (!result.error) router.refresh();
  }

  async function handleRemove(userId: string) {
    setRemoving(userId);
    const result = await removeRoomMember(roomId, userId);
    setRemoving(null);
    if (!result.error) router.refresh();
  }

  const displayName = (m: Member | AvailableUser) =>
    m.full_name?.trim() || m.email || ("user_id" in m ? m.user_id : m.id)?.slice(0, 8) || "";

  const panelContent = (
    <div
      className="w-72 rounded-xl border p-4 shadow-lg"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
    >
      <h3 className="mb-3 text-sm font-semibold text-white">Members</h3>
      <ul className="mb-4 max-h-72 space-y-2 overflow-y-auto pr-1">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-zinc-300">{displayName(m)}</span>
            {m.user_id !== currentUserId && (
              <button
                type="button"
                onClick={() => handleRemove(m.user_id)}
                disabled={!!removing}
                className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/20 disabled:opacity-50"
              >
                {removing === m.user_id ? "Removing…" : "Remove"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {availableUsers.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-zinc-500">Add person(s) – select multiple, then Add</p>
          <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-600 bg-zinc-800/60 p-2">
            {availableUsers.map((u) => (
              <li key={u.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700/50">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.has(u.id)}
                    onChange={() => toggleSelected(u.id)}
                    className="h-4 w-4 rounded border-zinc-500 bg-zinc-800 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="truncate">{displayName(u)}</span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleAdd}
            disabled={selectedUserIds.size === 0 || adding}
            className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {adding ? "Adding…" : selectedUserIds.size > 0 ? `Add (${selectedUserIds.size})` : "Add"}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative">
      {!hideTrigger && (
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={
          subtleOnDesktop
            ? "flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-emerald-500 hover:text-white md:rounded-lg md:border-0 md:bg-transparent md:px-2 md:py-1 md:font-normal md:text-zinc-500 md:hover:bg-zinc-700/50 md:hover:text-zinc-300"
            : "flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-emerald-500 hover:text-white"
        }
        title="Manage members"
        aria-label={`Members (${members.length})`}
      >
        {subtleOnDesktop ? (
          <>
            <span className="text-sm" aria-hidden>👥</span>
            <span className="hidden md:inline">Members</span>
          </>
        ) : (
          <>
            <span className="text-sm">👥</span>
            <span className="hidden sm:inline">Members</span>
            <span className="rounded-full bg-zinc-800 px-1.5 text-[10px] text-zinc-300">
              {members.length}
            </span>
          </>
        )}
      </button>
      )}
      {open && modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-label="Members"
          onClick={() => setOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            {panelContent}
          </div>
        </div>
      )}
      {open && !modal && (
        <div className="absolute left-0 top-full z-40 mt-2">
          {panelContent}
        </div>
      )}
    </div>
  );
}
