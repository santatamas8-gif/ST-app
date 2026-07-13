import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

import {
  KIOSK_LOCK_COOKIE_NAME,
  KIOSK_LOCK_COOKIE_VALUE,
} from "@/lib/kioskLock/constants";
import {
  applyKioskLockCookie,
  isKioskLockCookieValue,
  kioskLockCookieOptions,
  removeKioskLockCookie,
} from "@/lib/kioskLock/cookies.server";

describe("Kiosk Lock cookie constants and marker", () => {
  it("uses the approved cookie name", () => {
    expect(KIOSK_LOCK_COOKIE_NAME).toBe("stams_kiosk_lock");
  });

  it("recognizes only the active cookie value", () => {
    expect(isKioskLockCookieValue(KIOSK_LOCK_COOKIE_VALUE)).toBe(true);
    expect(isKioskLockCookieValue(undefined)).toBe(false);
    expect(isKioskLockCookieValue("")).toBe(false);
    expect(isKioskLockCookieValue("inactive")).toBe(false);
  });
});

describe("kioskLockCookieOptions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses HttpOnly, SameSite=Lax, and path=/", () => {
    const options = kioskLockCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("does not add persistent maxAge or expires options", () => {
    const options = kioskLockCookieOptions();
    expect("maxAge" in options).toBe(false);
    expect("expires" in options).toBe(false);
  });

  it("uses Secure in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(kioskLockCookieOptions().secure).toBe(true);
  });

  it("does not use Secure outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(kioskLockCookieOptions().secure).toBe(false);
  });
});

describe("Kiosk Lock response helpers", () => {
  it("sets the active lock cookie on a response", () => {
    const response = NextResponse.next();
    applyKioskLockCookie(response);
    expect(response.cookies.get(KIOSK_LOCK_COOKIE_NAME)?.value).toBe(KIOSK_LOCK_COOKIE_VALUE);
  });

  it("clears the lock cookie with deletion semantics", () => {
    const response = NextResponse.next();
    removeKioskLockCookie(response);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(KIOSK_LOCK_COOKIE_NAME);
    expect(setCookie.toLowerCase()).toContain("max-age=0");
    expect(setCookie).toContain("Path=/");
  });
});
