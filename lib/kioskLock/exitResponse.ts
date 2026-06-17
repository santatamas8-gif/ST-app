import type { KioskPinVerificationResult } from "@/lib/kioskLock/pin.server";

export const KIOSK_EXIT_REDIRECT_DESTINATION = "/dashboard";

export type KioskExitResponse =
  | {
      status: 200;
      body: {
        success: true;
        redirectTo: typeof KIOSK_EXIT_REDIRECT_DESTINATION;
      };
    }
  | {
      status: 400 | 401 | 503;
      body: {
        success: false;
        message: string;
      };
    };

export function mapKioskPinVerificationToExitResponse(
  result: KioskPinVerificationResult
): KioskExitResponse {
  if (result.ok) {
    return {
      status: 200,
      body: {
        success: true,
        redirectTo: KIOSK_EXIT_REDIRECT_DESTINATION,
      },
    };
  }

  if (result.reason === "not_configured") {
    return {
      status: 503,
      body: {
        success: false,
        message: "Kiosk exit is temporarily unavailable.",
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
