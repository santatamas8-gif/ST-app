"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, LogOut, X } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

type ExitResponse = {
  success?: boolean;
  message?: string;
  redirectTo?: string;
};

export function KioskExitButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCancel = useCallback(() => {
    if (isSubmitting) return;
    setOpen(false);
    setPin("");
    setMessage(null);
  }, [isSubmitting]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCancel();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleCancel, open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/kiosk-lock/exit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin }),
      });
      const data = (await response.json().catch(() => ({}))) as ExitResponse;

      if (response.ok && data.success && data.redirectTo === "/dashboard") {
        router.replace("/dashboard");
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
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMessage(null);
          setPin("");
        }}
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:border-red-400 hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-400"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        Exit Kiosk
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) handleCancel();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="kiosk-exit-title"
            className={`w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
            style={{ borderRadius: "12px" }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="kiosk-exit-title" className="text-lg font-semibold text-white">
                  Exit Kiosk Mode
                </h2>
                <p className={`mt-1 text-sm ${isHighContrast ? "text-white/75" : "text-zinc-400"}`}>
                  Enter the code to unlock navigation.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Cancel exit"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="kiosk-exit-pin"
                  className={`mb-1.5 block text-xs font-medium uppercase tracking-wide ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}
                >
                  Kiosk code
                </label>
                <div className="relative">
                  <LockKeyhole
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                    aria-hidden
                  />
                  <input
                    ref={inputRef}
                    id="kiosk-exit-pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    maxLength={12}
                    value={pin}
                    disabled={isSubmitting}
                    onChange={(event) => setPin(event.target.value)}
                    className="h-12 w-full rounded-lg border border-zinc-700 bg-zinc-800/80 pl-10 pr-3 text-lg font-semibold tracking-[0.35em] text-white outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
                    aria-describedby={message ? "kiosk-exit-error" : undefined}
                  />
                </div>
              </div>

              {message && (
                <p
                  id="kiosk-exit-error"
                  className="rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-300"
                  role="alert"
                >
                  {message}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="h-11 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-28"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || pin.trim().length === 0}
                  className="h-11 rounded-lg border border-red-600 bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:border-red-900 disabled:bg-red-950/50 disabled:text-red-500 sm:min-w-32"
                >
                  {isSubmitting ? "Checking..." : "Exit Kiosk"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
