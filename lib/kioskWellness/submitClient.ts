import type { KioskWellnessSubmitRequest } from "@/lib/kioskWellness/submitValidation";

export type KioskWellnessSubmitResult =
  | { ok: true }
  | { ok: false; message: string };

function readErrorMessage(data: unknown): string | null {
  if (data === null || typeof data !== "object" || !("error" in data)) return null;
  const error = (data as { error: unknown }).error;
  return typeof error === "string" && error.trim().length > 0 ? error.trim() : null;
}

export async function submitKioskWellnessEntry(
  payload: KioskWellnessSubmitRequest
): Promise<KioskWellnessSubmitResult> {
  try {
    const response = await fetch("/api/kiosk-wellness/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      if (!response.ok) {
        if (response.status === 401) {
          return { ok: false, message: "Your session has expired. Please sign in again." };
        }
        if (response.status === 403) {
          return {
            ok: false,
            message: "You do not have permission to submit Kiosk wellness data.",
          };
        }
        return { ok: false, message: "Unable to submit wellness. Please try again." };
      }
    }

    if (response.status === 401) {
      return { ok: false, message: "Your session has expired. Please sign in again." };
    }
    if (response.status === 403) {
      return {
        ok: false,
        message: "You do not have permission to submit Kiosk wellness data.",
      };
    }

    if (!response.ok) {
      const apiMessage = readErrorMessage(data);
      if (apiMessage) {
        return { ok: false, message: apiMessage };
      }
      return { ok: false, message: "Unable to submit wellness. Please try again." };
    }

    return { ok: true };
  } catch {
    return { ok: false, message: "Unable to submit wellness. Please try again." };
  }
}
