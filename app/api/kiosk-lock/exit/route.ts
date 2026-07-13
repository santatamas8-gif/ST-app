import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import {
  getKioskLockState,
  removeKioskLockCookie,
} from "@/lib/kioskLock/cookies.server";
import { mapKioskPinVerificationToExitResponse } from "@/lib/kioskLock/exitResponse";
import { verifyKioskPin } from "@/lib/kioskLock/pin.server";

function incorrectCodeResponse() {
  return NextResponse.json(
    {
      success: false,
      message: "Incorrect code.",
    },
    { status: 400 }
  );
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin" && user.role !== "staff") {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const kioskLocked = await getKioskLockState();
  if (!kioskLocked) {
    return NextResponse.json(
      {
        success: false,
        message: "Kiosk mode is not active.",
      },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return incorrectCodeResponse();
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return incorrectCodeResponse();
  }

  const pin = (body as Record<string, unknown>).pin;
  const mapped = mapKioskPinVerificationToExitResponse(verifyKioskPin(pin));
  const response = NextResponse.json(mapped.body, { status: mapped.status });
  if (mapped.body.success) {
    removeKioskLockCookie(response);
  }
  return response;
}
