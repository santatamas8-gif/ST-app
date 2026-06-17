import type { KioskPinVerificationResult } from "@/lib/kioskLock/pin.server";

export type KioskEnterFailureResponse = {
  status: 400 | 401 | 503;
  body: {
    success: false;
    message: string;
  };
};

export function mapKioskPinFailureToEnterResponse(
  result: Exclude<KioskPinVerificationResult, { ok: true }>
): KioskEnterFailureResponse {
  if (result.reason === "not_configured") {
    return {
      status: 503,
      body: {
        success: false,
        message: "Kiosk access is temporarily unavailable.",
      },
    };
  }

  if (result.reason === "incorrect") {
    return {
      status: 401,
      body: {
        success: false,
        message: "Incorrect code.",
      },
    };
  }

  return {
    status: 400,
    body: {
      success: false,
      message: "Incorrect code.",
    },
  };
}
