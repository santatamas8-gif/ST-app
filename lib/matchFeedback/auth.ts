import type { UserRole } from "@/lib/types";

/** Admin or staff may use Match Kiosk / read results. */
export function canAccessMatchFeedback(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "staff";
}

/** Only admin may create matches (and participant lists). Required even when service-role writes. */
export function canCreateMatchFeedback(role: UserRole | null | undefined): boolean {
  return role === "admin";
}

/** Only admin may delete matches from Wellness results. */
export function canDeleteMatchFeedback(role: UserRole | null | undefined): boolean {
  return role === "admin";
}

/** Admin or staff may submit/update questionnaire responses via kiosk API. */
export function canSubmitMatchFeedbackResponse(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "staff";
}
