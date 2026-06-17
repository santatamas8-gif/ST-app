import { describe, expect, it } from "vitest";
import { getKioskLockRequestDecision } from "@/lib/kioskLock/requestPolicy";

function decide({
  pathname,
  method = "GET",
  isAuthenticated = true,
  kioskLocked = true,
  role = "admin",
}: {
  pathname: string;
  method?: string;
  isAuthenticated?: boolean;
  kioskLocked?: boolean;
  role?: "admin" | "staff" | "player" | null;
}) {
  return getKioskLockRequestDecision({ pathname, method, isAuthenticated, kioskLocked, role });
}

describe("getKioskLockRequestDecision without active lock", () => {
  it("allows pages to follow existing middleware behavior", () => {
    expect(decide({ pathname: "/dashboard", kioskLocked: false })).toEqual({ type: "allow" });
    expect(decide({ pathname: "/rpe", kioskLocked: false })).toEqual({ type: "allow" });
  });

  it("does not block APIs by Kiosk policy", () => {
    expect(decide({ pathname: "/api/admin/delete-user", kioskLocked: false })).toEqual({
      type: "allow",
    });
  });
});

describe("getKioskLockRequestDecision with active lock and authenticated user", () => {
  it("allows the Kiosk page without redirect loops", () => {
    expect(decide({ pathname: "/kiosk-rpe" })).toEqual({ type: "allow" });
    expect(decide({ pathname: "/kiosk-rpe/help" })).toEqual({ type: "allow" });
  });

  it("redirects internal pages to Kiosk", () => {
    expect(decide({ pathname: "/" })).toEqual({ type: "redirect", destination: "/kiosk-rpe" });
    expect(decide({ pathname: "/dashboard" })).toEqual({
      type: "redirect",
      destination: "/kiosk-rpe",
    });
    expect(decide({ pathname: "/rpe" })).toEqual({
      type: "redirect",
      destination: "/kiosk-rpe",
    });
    expect(decide({ pathname: "/players/123" })).toEqual({
      type: "redirect",
      destination: "/kiosk-rpe",
    });
    expect(decide({ pathname: "/chat/thread" })).toEqual({
      type: "redirect",
      destination: "/kiosk-rpe",
    });
  });

  it("allows Kiosk APIs and health checks", () => {
    expect(decide({ pathname: "/api/kiosk-rpe/submit", method: "POST" })).toEqual({
      type: "allow",
    });
    expect(decide({ pathname: "/api/kiosk-lock/enter", method: "POST" })).toEqual({
      type: "allow",
    });
    expect(decide({ pathname: "/api/kiosk-lock/exit", method: "POST" })).toEqual({
      type: "allow",
    });
    expect(decide({ pathname: "/api/health" })).toEqual({ type: "allow" });
  });

  it("blocks unrelated APIs with 423", () => {
    expect(decide({ pathname: "/api/auth/signout", method: "POST" })).toEqual({
      type: "block_api",
      status: 423,
    });
    expect(decide({ pathname: "/api/admin/delete-user", method: "POST" })).toEqual({
      type: "block_api",
      status: 423,
    });
  });

  it("allows static and framework infrastructure", () => {
    expect(decide({ pathname: "/_next/static/chunk.js" })).toEqual({ type: "allow" });
    expect(decide({ pathname: "/favicon.ico" })).toEqual({ type: "allow" });
    expect(decide({ pathname: "/manifest.json" })).toEqual({ type: "allow" });
  });
});

describe("getKioskLockRequestDecision with active lock and non-Kiosk roles", () => {
  it("does not force Player users into a Kiosk redirect loop from a stale lock cookie", () => {
    expect(decide({ pathname: "/dashboard", role: "player" })).toEqual({ type: "allow" });
    expect(decide({ pathname: "/kiosk-rpe", role: "player" })).toEqual({ type: "allow" });
  });

  it("allows existing auth behavior when the app role cannot be confirmed", () => {
    expect(decide({ pathname: "/dashboard", role: null })).toEqual({ type: "allow" });
  });
});

describe("getKioskLockRequestDecision for unauthenticated stale lock", () => {
  it("allows login and auth callback instead of forcing Kiosk redirects", () => {
    expect(decide({ pathname: "/login", isAuthenticated: false })).toEqual({ type: "allow" });
    expect(decide({ pathname: "/auth/callback", isAuthenticated: false })).toEqual({
      type: "allow",
    });
  });

  it("lets protected pages follow the existing auth behavior", () => {
    expect(decide({ pathname: "/dashboard", isAuthenticated: false })).toEqual({
      type: "allow",
    });
  });
});
