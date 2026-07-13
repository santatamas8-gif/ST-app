import { describe, expect, it } from "vitest";
import { mapKioskPinFailureToEnterResponse } from "@/lib/kioskLock/enterResponse";

describe("mapKioskPinFailureToEnterResponse", () => {
  it("maps incorrect PIN to a generic incorrect-code response", () => {
    expect(mapKioskPinFailureToEnterResponse({ ok: false, reason: "incorrect" })).toEqual({
      status: 401,
      body: {
        success: false,
        message: "Incorrect code.",
      },
    });
  });

  it("maps invalid input to a controlled incorrect-code response", () => {
    expect(mapKioskPinFailureToEnterResponse({ ok: false, reason: "invalid_input" })).toEqual({
      status: 400,
      body: {
        success: false,
        message: "Incorrect code.",
      },
    });
  });

  it("maps missing configuration to a temporary unavailable response", () => {
    expect(mapKioskPinFailureToEnterResponse({ ok: false, reason: "not_configured" })).toEqual({
      status: 503,
      body: {
        success: false,
        message: "Kiosk access is temporarily unavailable.",
      },
    });
  });

  it("does not include submitted or configured PIN values in public response data", () => {
    const response = mapKioskPinFailureToEnterResponse({ ok: false, reason: "incorrect" });
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("111");
    expect(serialized).not.toContain("987654");
  });
});
