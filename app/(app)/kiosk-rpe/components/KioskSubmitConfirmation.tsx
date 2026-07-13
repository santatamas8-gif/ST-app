"use client";

import { useEffect, useRef } from "react";
import { getKioskSubmissionConfirmationCopy } from "@/lib/kioskRpe/submissionConfirmation";

const CARD_RADIUS = "12px";

type KioskSubmitConfirmationProps = {
  open: boolean;
  completedCount: number;
  missingCount: number;
  todayBatchCount: number;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function KioskSubmitConfirmation({
  open,
  completedCount,
  missingCount,
  todayBatchCount,
  isSubmitting,
  onCancel,
  onConfirm,
}: KioskSubmitConfirmationProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const copy = getKioskSubmissionConfirmationCopy({
    completedCount,
    missingCount,
    todayBatchCount,
  });

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kiosk-submit-confirm-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-xl sm:p-6"
        style={{ borderRadius: CARD_RADIUS, backgroundColor: "var(--card-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="kiosk-submit-confirm-title" className="text-lg font-semibold text-white">
          {copy.title}
        </h2>
        <p className="mt-3 text-sm text-zinc-300">
          {copy.message}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
          {isSubmitting ? "Submitting..." : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
