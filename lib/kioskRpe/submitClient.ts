import type { KioskRpeSubmitRequest } from "@/lib/kioskRpe/submitValidation";

export type KioskSubmitResult =
  | { ok: true; insertedCount: number }
  | { ok: false; message: string };

function readErrorMessage(data: unknown): string | null {
  if (data === null || typeof data !== "object" || !("error" in data)) return null;
  const error = (data as { error: unknown }).error;
  return typeof error === "string" && error.trim().length > 0 ? error.trim() : null;
}

export async function submitKioskRpeEntries(
  payload: KioskRpeSubmitRequest
): Promise<KioskSubmitResult> {
  try {
    const response = await fetch("/api/kiosk-rpe/submit", {
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
            message: "You do not have permission to submit Kiosk RPE data.",
          };
        }
        return { ok: false, message: "Unable to submit RPE entries. Please try again." };
      }
    }

    if (response.status === 401) {
      return { ok: false, message: "Your session has expired. Please sign in again." };
    }
    if (response.status === 403) {
      return {
        ok: false,
        message: "You do not have permission to submit Kiosk RPE data.",
      };
    }

    if (!response.ok) {
      const apiMessage = readErrorMessage(data);
      if (response.status === 400 && apiMessage) {
        return { ok: false, message: apiMessage };
      }
      return { ok: false, message: "Unable to submit RPE entries. Please try again." };
    }

    const insertedCount =
      data !== null &&
      typeof data === "object" &&
      "insertedCount" in data &&
      typeof (data as { insertedCount: unknown }).insertedCount === "number"
        ? (data as { insertedCount: number }).insertedCount
        : payload.entries.length;

    return { ok: true, insertedCount };
  } catch {
    return { ok: false, message: "Unable to submit RPE entries. Please try again." };
  }
}
