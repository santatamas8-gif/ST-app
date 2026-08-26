import type { UserRole } from "@/lib/types";

export type ProfileRoleAction =
  | "none"
  | "insert-admin"
  | "insert-player"
  | "restore-admin";

export type ProfileRoleDecision = {
  role: UserRole;
  action: ProfileRoleAction;
};

/**
 * Decide how to handle a profiles.role after login / session load.
 * Never overwrite an existing non-empty role with player.
 * Immutable admin is always treated as admin and restored if demoted.
 */
export function decideProfileRoleAction(input: {
  role: UserRole | null;
  profileExists: boolean;
  readFailed: boolean;
  isImmutableAdmin: boolean;
}): ProfileRoleDecision {
  if (input.isImmutableAdmin) {
    if (input.profileExists && input.role === "admin") {
      return { role: "admin", action: "none" };
    }
    if (input.profileExists || input.readFailed) {
      return { role: "admin", action: "restore-admin" };
    }
    return { role: "admin", action: "insert-admin" };
  }

  if (input.profileExists && input.role) {
    return { role: input.role, action: "none" };
  }

  if (input.readFailed) {
    return { role: "player", action: "none" };
  }

  if (!input.profileExists) {
    return { role: "player", action: "insert-player" };
  }

  return { role: "player", action: "none" };
}
