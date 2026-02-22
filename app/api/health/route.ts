import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function supabaseHostFromUrl(url: string | undefined): string {
  if (!url || typeof url !== "string") return "(not set)";
  try {
    return new URL(url).hostname;
  } catch {
    return "(invalid)";
  }
}

export async function GET() {
  const buildEnv = process.env.NODE_ENV ?? "unknown";
  const supabaseHost = supabaseHostFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

  let db: "ok" | "failed" = "failed";
  let auth: "ok" | "failed" = "failed";
  let errorCode: string | null = null;
  let message: string | null = null;

  try {
    const supabase = await createClient();
    const { error: dbErr } = await supabase.from("profiles").select("id").limit(1).maybeSingle();
    db = dbErr ? "failed" : "ok";
    if (dbErr) {
      errorCode = errorCode ?? dbErr.code ?? "db_error";
      message = message ?? dbErr.message;
    }
  } catch (e) {
    errorCode = errorCode ?? "db_exception";
    message = message ?? (e instanceof Error ? e.message : "DB check failed");
  }

  try {
    const supabase = await createClient();
    await supabase.auth.getUser();
    auth = "ok";
  } catch (e) {
    auth = "failed";
    errorCode = errorCode ?? "auth_exception";
    message = message ?? (e instanceof Error ? e.message : "Auth check failed");
  }

  const ok = db === "ok" && auth === "ok";

  return NextResponse.json({
    ok,
    buildEnv,
    supabaseHost,
    db,
    auth,
    ...(errorCode && { errorCode }),
    ...(message && ok === false && { message }),
  });
}
