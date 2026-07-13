import { createClient } from "@/lib/supabase/server";
import { getKioskLockState } from "@/lib/kioskLock/cookies.server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (await getKioskLockState()) {
    return NextResponse.redirect(new URL("/kiosk-rpe", url.origin), { status: 302 });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", url.origin), { status: 302 });
}
