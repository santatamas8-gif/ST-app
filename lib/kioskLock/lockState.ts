import { KIOSK_LOCK_COOKIE_VALUE } from "@/lib/kioskLock/constants";

export function hasActiveKioskLockCookie(value: string | undefined): boolean {
  return value === KIOSK_LOCK_COOKIE_VALUE;
}
