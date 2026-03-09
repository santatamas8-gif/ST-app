"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function LoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // LOGIN OK → dashboard
    window.location.href = "/dashboard";
  }

  return (
    <div className="login-page-bg relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 min-[480px]:py-12">
      <div className="relative z-10 w-full max-w-sm">
        <div className="login-card rounded-2xl border border-white/10 p-6 sm:p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              <span className="text-white">ST</span>{" "}
              <span className="text-emerald-400">AMS</span>
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Sign in to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-zinc-300">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="login-input mt-1.5 block w-full rounded-xl border border-zinc-600/80 bg-zinc-800/80 px-3 py-2.5 text-white placeholder-zinc-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-zinc-300">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="login-input block w-full rounded-xl border border-zinc-600/80 bg-zinc-800/80 py-2.5 pl-3 pr-10 text-white placeholder-zinc-500 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-700/80 hover:text-white"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="login-signin-btn w-full rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-3 font-semibold text-white transition hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-70"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-emerald-400 hover:text-emerald-300">
              Sign up
            </Link>
          </p>
          <p className="mt-4 text-center text-xs text-zinc-500">
            Add to home screen for quicker access.
          </p>
        </div>
      </div>
    </div>
  );
}
