import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { applyKioskLockCookie } from "@/lib/kioskLock/cookies.server";
import { mapKioskPinFailureToEnterResponse } from "@/lib/kioskLock/enterResponse";
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
  const verification = verifyKioskPin(pin);
  if (!verification.ok) {
    const response = mapKioskPinFailureToEnterResponse(verification);
    return NextResponse.json(response.body, { status: response.status });
  }

  const response = NextResponse.json({ success: true });
  applyKioskLockCookie(response);
  return response;
}
