import type { MatchFeedbackCreateRequest, MatchFeedbackSubmitRequest } from "./types";

export async function createMatchFeedbackMatch(
  body: MatchFeedbackCreateRequest
): Promise<{ ok: true; matchId: string } | { ok: false; message: string; status?: number }> {
  try {
    const res = await fetch("/api/kiosk-match/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; matchId?: string };
    if (!res.ok) {
      return { ok: false, message: json.error ?? "Failed to create match.", status: res.status };
    }
    if (!json.matchId) {
      return { ok: false, message: "Create match succeeded without match ID." };
    }
    return { ok: true, matchId: json.matchId };
  } catch {
    return { ok: false, message: "Network error creating match." };
  }
}

export async function submitMatchFeedbackResponse(
  body: MatchFeedbackSubmitRequest
): Promise<
  | { ok: true; responseId: string; updated: boolean; updatedAt: string }
  | { ok: false; message: string; status?: number }
> {
  try {
    const res = await fetch("/api/kiosk-match/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      responseId?: string;
      updated?: boolean;
      updatedAt?: string;
    };
    if (!res.ok) {
      return { ok: false, message: json.error ?? "Failed to save response.", status: res.status };
    }
    if (!json.responseId || !json.updatedAt) {
      return { ok: false, message: "Save succeeded without response metadata." };
    }
    return {
      ok: true,
      responseId: json.responseId,
      updated: Boolean(json.updated),
      updatedAt: json.updatedAt,
    };
  } catch {
    return { ok: false, message: "Network error saving response." };
  }
}
