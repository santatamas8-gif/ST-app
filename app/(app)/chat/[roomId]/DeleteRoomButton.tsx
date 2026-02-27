"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteChatRoom } from "@/app/actions/chat";

export function DeleteRoomButton({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function handleDelete() {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setLoading(true);
    const result = await deleteChatRoom(roomId);
    setLoading(false);
    if (result.error) return;
    router.push("/chat");
    router.refresh();
  }

  const label = loading ? "Deleting…" : confirm ? "Confirm delete room" : "Delete room";
  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      title={label}
      aria-label={label}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
        confirm
          ? "bg-red-600 text-white hover:bg-red-500"
          : "border border-red-500/50 text-red-400 hover:bg-red-500/10"
      }`}
    >
      <span aria-hidden>🗑️</span>
      <span className={(loading || confirm) ? "inline" : "hidden sm:inline"}>{label}</span>
    </button>
  );
}
