import "server-only";

import { timingSafeEqual } from "node:crypto";
import {
  KIOSK_PIN_ENV_NAME,
  KIOSK_PIN_MAX_LENGTH,
  KIOSK_PIN_MIN_LENGTH,
} from "@/lib/kioskLock/constants";

export type KioskPinVerificationResult =
  | { ok: true }
  | {
      ok: false;
      reason: "incorrect" | "invalid_input" | "not_configured";
    };

function normalizeKioskPin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (
    trimmed.length < KIOSK_PIN_MIN_LENGTH ||
    trimmed.length > KIOSK_PIN_MAX_LENGTH ||
    !/^\d+$/.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

function constantTimeEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

export function verifyKioskPin(submittedPin: unknown): KioskPinVerificationResult {
  const configuredPin = normalizeKioskPin(process.env[KIOSK_PIN_ENV_NAME]);
  if (configuredPin === null) {
    return { ok: false, reason: "not_configured" };
  }

  const normalizedSubmittedPin = normalizeKioskPin(submittedPin);
  if (normalizedSubmittedPin === null) {
    return { ok: false, reason: "invalid_input" };
  }

  if (!constantTimeEquals(normalizedSubmittedPin, configuredPin)) {
    return { ok: false, reason: "incorrect" };
  }

  return { ok: true };
}
