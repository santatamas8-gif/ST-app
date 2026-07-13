import type { SessionRow } from "@/lib/types";

export const PLAYER_A = "11111111-1111-4111-8111-111111111111";
export const PLAYER_B = "22222222-2222-4222-8222-222222222222";
export const PLAYER_C = "33333333-3333-4333-8333-333333333333";
export const PLAYER_D = "44444444-4444-4444-8444-444444444444";
export const STAFF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

export function makeSession(
  partial: Partial<SessionRow> & Pick<SessionRow, "id" | "user_id" | "date">
): SessionRow {
  return {
    duration: 75,
    rpe: 7,
    load: 525,
    session_type: "Pitch",
    matchday_tag: "MD-3",
    ...partial,
  };
}
