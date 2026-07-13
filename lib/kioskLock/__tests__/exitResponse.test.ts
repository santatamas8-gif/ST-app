import { describe, expect, it } from "vitest";
import {
  KIOSK_EXIT_REDIRECT_DESTINATION,
  mapKioskPinVerificationToExitResponse,
} from "@/lib/kioskLock/exitResponse";

describe("mapKioskPinVerificationToExitResponse", () => {
  it("maps successful PIN verification to a fixed dashboard destination", () => {
    expect(mapKioskPinVerificationToExitResponse({ ok: true })).toEqual({
      status: 200,
      body: {
        success: true,
        redirectTo: "/dashboard",
      },
    });
    expect(KIOSK_EXIT_REDIRECT_DESTINATION).toBe("/dashboard");
  });

  it("maps incorrect PIN to a generic incorrect-code response", () => {
    expect(mapKioskPinVerificationToExitResponse({ ok: false, reason: "incorrect" })).toEqual({
      status: 401,
      body: {
        success: false,
        message: "Incorrect code.",
      },
    });
  });

  it("maps invalid input to a controlled incorrect-code response", () => {
    expect(mapKioskPinVerificationToExitResponse({ ok: false, reason: "invalid_input" })).toEqual({
      status: 400,
      body: {
        success: false,
        message: "Incorrect code.",
      },
    });
  });

  it("maps missing configuration to a temporary unavailable response", () => {
    expect(mapKioskPinVerificationToExitResponse({ ok: false, reason: "not_configured" })).toEqual({
      status: 503,
      body: {
        success: false,
        message: "Kiosk exit is temporarily unavailable.",
      },
    });
  });

  it("does not include submitted or configured PIN values in response data", () => {
    const failure = mapKioskPinVerificationToExitResponse({ ok: false, reason: "incorrect" });
    const success = mapKioskPinVerificationToExitResponse({ ok: true });
    const serialized = JSON.stringify({ failure, success });
    expect(serialized).not.toContain("111");
    expect(serialized).not.toContain("987654");
  });
});
