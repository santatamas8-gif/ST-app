import "server-only";

import { getAppUser } from "@/lib/auth";
import { canAccessDrillAnalysis } from "@/lib/drillAnalysis/nav";
import type { AppUser } from "@/lib/types";

export async function requireDrillAnalysisStaff(): Promise<
  | { ok: true; user: AppUser }
  | { ok: false; status: 401 | 403; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, status: 401, error: "Sign in required." };
  if (!canAccessDrillAnalysis(user.role)) {
    return { ok: false, status: 403, error: "Staff access required." };
  }
  return { ok: true, user };
}
