"use client";

import { useState } from "react";
import { createPlayer } from "@/app/actions/users";

export function AddPlayerForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    const result = await createPlayer({ email: email.trim(), password });
    setLoading(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "success", text: "Player created. They can sign in with the email and password." });
    setEmail("");
    setPassword("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="new-player-email" className="block text-sm font-medium text-zinc-300">
          Email
        </label>
        <input
          id="new-player-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="off"
          placeholder="jatekos@example.com"
          className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500"
        />
      </div>
      <div>
        <label htmlFor="new-player-password" className="block text-sm font-medium text-zinc-300">
          Password (min. 6 characters)
        </label>
        <input
          id="new-player-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="••••••••"
          className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500"
        />
      </div>
      {message && (
        <p
          className={
            message.type === "success"
              ? "text-sm text-emerald-400"
              : "text-sm text-red-400"
          }
        >
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {loading ? "Creating…" : "Add player"}
      </button>
    </form>
  );
}
