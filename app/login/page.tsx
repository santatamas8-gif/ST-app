"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPublicTeamLogo } from "@/app/actions/teamSettings";

const REMEMBER_EMAIL_KEY = "stams_remember_email";
const REMEMBER_ME_KEY = "stams_remember_me";

export default function LoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [teamLogoUrl, setTeamLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    getPublicTeamLogo().then((r) => {
      if (r.team_logo_url) setTeamLogoUrl(r.team_logo_url);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
      const remembered = localStorage.getItem(REMEMBER_ME_KEY) === "1";
      if (saved) setEmail(saved);
      if (remembered) setRememberMe(true);
    } catch {
      // ignore
    }
  }, []);

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

    try {
      if (rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, email);
        localStorage.setItem(REMEMBER_ME_KEY, "1");
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
        localStorage.removeItem(REMEMBER_ME_KEY);
      }
    } catch {
      // ignore
    }

    // LOGIN OK → dashboard
    window.location.href = "/dashboard";
  }

  return (
    <div className="login-page-bg relative flex min-h-screen flex-col items-center justify-start overflow-hidden px-4 pt-6 pb-10 min-[480px]:pt-8 min-[480px]:pb-14">
      {/* Header – closer lines, block moved higher */}
      <header className="relative z-10 mb-8 mt-0 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          ST<span className="mx-1 inline-block h-1 w-3 align-middle bg-zinc-600/60" aria-hidden /><span className="text-[#1eb871]">AMS</span>
        </h1>
        <p className="mt-1 text-lg font-normal text-zinc-400">
          Athlete Monitoring System
        </p>
      </header>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm">
        <div
          className="rounded-2xl border border-zinc-700 bg-zinc-900/80 pt-4 px-6 pb-6 shadow-xl shadow-black/20 sm:pt-5 sm:px-8 sm:pb-8"
          style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)" }}
        >
          {teamLogoUrl ? (
            <div className="mb-2 flex justify-center">
              <img
                src={teamLogoUrl}
                alt=""
                width={36}
                height={36}
                fetchPriority="high"
                className="h-8 w-8 rounded-lg object-contain sm:h-9 sm:w-9"
                aria-hidden
              />
            </div>
          ) : null}
          <h2 className="mb-6 text-center text-base font-medium text-zinc-200">
            Sign in to continue
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                className="login-input mt-2 block w-full rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-2.5 text-white placeholder-zinc-500 transition-colors focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-zinc-300">
                Password
              </label>
              <div className="relative mt-2">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="login-input block w-full rounded-lg border border-zinc-600 bg-zinc-800/80 py-2.5 pl-3 pr-10 text-white placeholder-zinc-500 transition-colors focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-700/80 hover:text-white"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="login-remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-500 bg-zinc-800 text-[#1eb871] focus:ring-[#1eb871]"
              />
              <label htmlFor="login-remember" className="text-sm text-zinc-400">
                Remember me
              </label>
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-3.5 font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-70"
              style={{ backgroundColor: "#1eb871", boxShadow: "0 10px 25px -5px rgba(30,184,113,0.3)" }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-zinc-500">
            Need access? Contact your{" "}
            <span className="font-medium text-[#1eb871]">administrator</span>.
          </p>
        </div>
      </div>

      <a
        href="mailto:santatamas8@gmail.com"
        className="absolute bottom-3 right-3 z-10 text-[10px] text-zinc-500/80 hover:text-zinc-400 sm:bottom-5 sm:right-5 sm:text-[11px]"
      >
        contact:santatamas8@gmail.com
      </a>
    </div>
  );
}
