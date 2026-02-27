"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createChatRoom } from "@/app/actions/chat";

export function CreateChatRoomForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Room name is required.");
      return;
    }
    setLoading(true);
    const result = await createChatRoom(trimmed);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Room name"
        maxLength={100}
        className="min-w-0 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:w-48"
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create room"}
      </button>
      {error && <p className="text-sm text-red-400 sm:self-center">{error}</p>}
    </form>
  );
}
