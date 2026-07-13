import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { KIOSK_PIN_ENV_NAME } from "@/lib/kioskLock/constants";
import { verifyKioskPin } from "@/lib/kioskLock/pin.server";

const ORIGINAL_KIOSK_PIN = process.env[KIOSK_PIN_ENV_NAME];

function setConfiguredPin(value: string | undefined) {
  if (value === undefined) {
    delete process.env[KIOSK_PIN_ENV_NAME];
    return;
  }
  process.env[KIOSK_PIN_ENV_NAME] = value;
}

describe("verifyKioskPin", () => {
  beforeEach(() => {
    setConfiguredPin("111");
  });

  afterEach(() => {
    setConfiguredPin(ORIGINAL_KIOSK_PIN);
  });

  it("accepts the correct configured PIN", () => {
    expect(verifyKioskPin("111")).toEqual({ ok: true });
  });

  it("rejects a wrong valid-format PIN as incorrect", () => {
    expect(verifyKioskPin("112")).toEqual({ ok: false, reason: "incorrect" });
  });

  it("trims surrounding whitespace on the submitted PIN", () => {
    expect(verifyKioskPin(" 111 ")).toEqual({ ok: true });
  });

  it("trims surrounding whitespace on the configured PIN", () => {
    setConfiguredPin(" 1234 ");
    expect(verifyKioskPin("1234")).toEqual({ ok: true });
  });

  it("rejects non-string input", () => {
    expect(verifyKioskPin(111)).toEqual({ ok: false, reason: "invalid_input" });
    expect(verifyKioskPin(null)).toEqual({ ok: false, reason: "invalid_input" });
  });

  it("rejects empty input", () => {
    expect(verifyKioskPin("")).toEqual({ ok: false, reason: "invalid_input" });
    expect(verifyKioskPin("   ")).toEqual({ ok: false, reason: "invalid_input" });
  });

  it("rejects alphabetic and mixed input", () => {
    expect(verifyKioskPin("abc")).toEqual({ ok: false, reason: "invalid_input" });
    expect(verifyKioskPin("12a")).toEqual({ ok: false, reason: "invalid_input" });
  });

  it("rejects submitted PINs shorter than 3 digits", () => {
    expect(verifyKioskPin("11")).toEqual({ ok: false, reason: "invalid_input" });
  });

  it("rejects excessively long submitted PINs", () => {
    expect(verifyKioskPin("1234567890123")).toEqual({
      ok: false,
      reason: "invalid_input",
    });
  });

  it("returns not_configured when the environment variable is missing", () => {
    setConfiguredPin(undefined);
    expect(verifyKioskPin("111")).toEqual({ ok: false, reason: "not_configured" });
  });

  it("returns not_configured when the configured PIN is invalid", () => {
    setConfiguredPin("abc");
    expect(verifyKioskPin("111")).toEqual({ ok: false, reason: "not_configured" });

    setConfiguredPin("12");
    expect(verifyKioskPin("111")).toEqual({ ok: false, reason: "not_configured" });
  });

  it("does not include submitted or configured PIN values in result data", () => {
    setConfiguredPin("987654");
    const result = verifyKioskPin("123456");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("123456");
    expect(serialized).not.toContain("987654");
  });
});
