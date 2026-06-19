"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Monitor } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";

const CARD_RADIUS = "18px";

type EnterResponse = {
  success?: boolean;
  message?: string;
};

export function KioskPinGate() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cardStyle =
    themeId === "neon"
      ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
      : themeId === "matt"
        ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
        : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/kiosk-lock/enter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin }),
      });
      const data = (await response.json().catch(() => ({}))) as EnterResponse;

      if (response.ok && data.success) {
        if (window.matchMedia("(max-width: 640px)").matches) {
          window.location.replace("/kiosk-rpe");
          return;
        }
        router.replace("/kiosk-rpe");
        router.refresh();
        return;
      }

      setMessage(data.message || "Unable to verify the code. Please try again.");
      setPin("");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } catch {
      setMessage("Unable to verify the code. Please try again.");
      setPin("");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[62vh] w-full max-w-[500px] items-center justify-center px-3 py-8 sm:py-10">
      <section
        className={`relative w-full overflow-hidden rounded-[18px] border border-emerald-400/30 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)] sm:p-5 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
        style={cardStyle}
        aria-label="Kiosk PIN entry"
      >
        <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-emerald-400/18 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 -right-16 h-44 w-44 rounded-full bg-cyan-400/12 blur-3xl" aria-hidden />

        <div className="relative">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/35 bg-emerald-400/10 text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.12)]">
              <Monitor className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${isHighContrast ? "text-emerald-100/70" : "text-zinc-500"}`}>
                Kiosk Lock
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Enter Kiosk PIN</h1>
            </div>
          </div>

          <p className={`mb-5 text-sm leading-6 ${isHighContrast ? "text-white/80" : "text-zinc-400"}`}>
            Enter the staff PIN to continue.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="kiosk-pin"
                className={`mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}
              >
                Kiosk PIN
              </label>
              <div className="relative">
                <LockKeyhole
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden
                />
                <input
                  ref={inputRef}
                  id="kiosk-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  maxLength={12}
                  value={pin}
                  disabled={isSubmitting}
                  onChange={(event) => setPin(event.target.value)}
                  className="h-12 w-full rounded-xl border border-zinc-700/90 bg-zinc-950/45 px-12 text-center text-2xl font-semibold tracking-[0.34em] text-white outline-none transition focus:border-emerald-300 focus:bg-zinc-950/65 focus:ring-2 focus:ring-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-70 sm:h-[52px]"
                  aria-describedby={message ? "kiosk-pin-error" : undefined}
                />
              </div>
            </div>

            {message && (
              <p id="kiosk-pin-error" className="rounded-lg border border-red-900/60 bg-red-950/25 px-3 py-2 text-sm text-red-300" role="alert">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || pin.trim().length === 0}
              className="flex h-12 w-full items-center justify-center rounded-xl border border-emerald-300/70 bg-gradient-to-r from-emerald-400 to-cyan-300 px-4 text-base font-bold text-zinc-950 shadow-[0_12px_28px_rgba(16,185,129,0.22)] transition hover:from-emerald-300 hover:to-cyan-200 hover:shadow-[0_14px_34px_rgba(16,185,129,0.3)] focus:outline-none focus:ring-2 focus:ring-emerald-300/60 focus:ring-offset-2 focus:ring-offset-zinc-950 active:scale-[0.99] disabled:cursor-not-allowed disabled:border-emerald-800/60 disabled:from-emerald-950/50 disabled:to-emerald-950/35 disabled:text-emerald-700 disabled:shadow-none sm:h-[52px]"
            >
              {isSubmitting ? "Checking..." : "Start Kiosk"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
