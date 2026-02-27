"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addRoomMember, removeRoomMember } from "@/app/actions/chat";

type Member = { user_id: string; email: string; full_name: string | null };
type AvailableUser = { id: string; email: string; full_name: string | null };

export function RoomMembersManager({
  roomId,
  members,
  availableUsers,
  currentUserId,
}: {
  roomId: string;
  members: Member[];
  availableUsers: AvailableUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");

  async function handleAdd() {
    if (!selectedUserId) return;
    setAdding(selectedUserId);
    const result = await addRoomMember(roomId, selectedUserId);
    setAdding(null);
    setSelectedUserId("");
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

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
    >
      <h3 className="mb-3 text-sm font-semibold text-white">Members</h3>
      <ul className="mb-4 space-y-2">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-zinc-300">{displayName(m)}</span>
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
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Add person…</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {displayName(u)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selectedUserId || !!adding}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      )}
    </div>
  );
}
