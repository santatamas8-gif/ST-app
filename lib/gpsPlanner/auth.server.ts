import "server-only";

import { getAppUser, isAdmin } from "@/lib/auth";
import {
  plannerErr,
  type PlannerSafeError,
} from "@/lib/gpsPlanner/common";

export async function requirePlannerAdmin(): Promise<PlannerSafeError | null> {
  const user = await getAppUser();
  if (!user) {
    return plannerErr("unauthorized", "Authentication required.");
  }
  if (!isAdmin(user.role)) {
    return plannerErr("unauthorized", "Admin access required.");
  }
  return null;
}

export async function requirePlannerAdminUser(): Promise<
  | { ok: true; user: { id: string; email: string; role: string } }
  | { ok: false; error: PlannerSafeError }
> {
  const user = await getAppUser();
  if (!user) {
    return {
      ok: false,
      error: plannerErr("unauthorized", "Authentication required."),
    };
  }
  if (!isAdmin(user.role)) {
    return {
      ok: false,
      error: plannerErr("unauthorized", "Admin access required."),
    };
  }
  return { ok: true, user };
}
