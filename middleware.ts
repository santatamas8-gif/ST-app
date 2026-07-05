import { type NextRequest, NextResponse } from "next/server";
import { KIOSK_LOCK_COOKIE_NAME } from "@/lib/kioskLock/constants";
import { hasActiveKioskLockCookie } from "@/lib/kioskLock/lockState";
import { getKioskLockRequestDecision } from "@/lib/kioskLock/requestPolicy";
import { updateSession } from "@/lib/supabase/middleware";
import type { UserRole } from "@/lib/types";

const APP_ROUTES = /^\/(dashboard|admin|wellness|rpe|recovery-protocol|players|schedule|users|chat|kiosk-rpe)(\/|$)/;

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const path = request.nextUrl.pathname;
  if (APP_ROUTES.test(path) && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const kioskLocked = hasActiveKioskLockCookie(
    request.cookies.get(KIOSK_LOCK_COOKIE_NAME)?.value
  );
  let role: UserRole | null = null;
  if (kioskLocked && user && supabase) {
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    role = (data?.role as UserRole | undefined) ?? null;
  }
  const decision = getKioskLockRequestDecision({
    pathname: path,
    method: request.method,
    isAuthenticated: Boolean(user),
    kioskLocked,
    role,
  });

  if (decision.type === "redirect") {
    return NextResponse.redirect(new URL(decision.destination, request.url));
  }

  if (decision.type === "block_api") {
    return NextResponse.json(
      {
        success: false,
        message: "Kiosk mode is active.",
      },
      { status: decision.status }
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)",
  ],
};

