import "server-only";

import { getAppUser, isAdmin } from "@/lib/auth";
import type { AppUser } from "@/lib/types";

export async function requireMovementPrepAdmin(): Promise<
  | { ok: true; user: AppUser }
  | { ok: false; status: 401 | 403; error: string }
> {
  const user = await getAppUser();
  if (!user) return { ok: false, status: 401, error: "Sign in required." };
  if (!isAdmin(user.role)) {
    return { ok: false, status: 403, error: "Admin access required." };
  }
  return { ok: true, user };
}
