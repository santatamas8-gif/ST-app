import "server-only";

import { cookies } from "next/headers";
import { type NextResponse } from "next/server";
import {
  KIOSK_LOCK_COOKIE_NAME,
  KIOSK_LOCK_COOKIE_VALUE,
} from "@/lib/kioskLock/constants";
import { hasActiveKioskLockCookie } from "@/lib/kioskLock/lockState";

export function kioskLockCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

export function isKioskLockCookieValue(value: string | undefined): boolean {
  return hasActiveKioskLockCookie(value);
}

export async function getKioskLockState(): Promise<boolean> {
  const cookieStore = await cookies();
  return isKioskLockCookieValue(cookieStore.get(KIOSK_LOCK_COOKIE_NAME)?.value);
}

export function applyKioskLockCookie(response: NextResponse): void {
  response.cookies.set(
    KIOSK_LOCK_COOKIE_NAME,
    KIOSK_LOCK_COOKIE_VALUE,
    kioskLockCookieOptions()
  );
}

export function removeKioskLockCookie(response: NextResponse): void {
  response.cookies.set(KIOSK_LOCK_COOKIE_NAME, "", {
    ...kioskLockCookieOptions(),
    maxAge: 0,
  });
}
