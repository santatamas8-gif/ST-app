import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { runQuery } from "@/lib/supabase/safeQuery";
import { AdminUsersView } from "./AdminUsersView";

export type ProfileRow = {
  id: string;
  email: string;
  role: string;
  created_at: string | null;
  full_name?: string | null;
};

function supabaseHostFromUrl(url: string | undefined): string {
  if (!url || typeof url !== "string") return "(not set)";
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return "(invalid URL)";
  }
}

export default async function AdminUsersPage() {
  const user = await getAppUser();
  const supabase = await createClient();
  const { data: profiles, error: queryError } = await runQuery(
    "admin-users-profiles",
    async () => {
      const r = await supabase
        .from("profiles")
        .select("id, email, role, created_at, full_name")
        .order("created_at", { ascending: false });
      return { data: (r.data ?? []) as ProfileRow[], error: r.error };
    }
  );
  const list: ProfileRow[] = (profiles ?? []).map((p: ProfileRow) => ({
    id: p.id,
    email: p.email ?? "",
    role: p.role ?? "player",
    created_at: p.created_at ?? null,
    full_name: p.full_name ?? null,
  }));

  const loadError = queryError;

  const envCheck =
    user?.role === "admin"
      ? {
          supabaseHost: supabaseHostFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
          buildEnv: process.env.NODE_ENV ?? "unknown",
          currentUserId: user?.id ?? null,
          currentUserRole: user?.role ?? null,
        }
      : null;

  return (
    <AdminUsersView
      list={list}
      loadError={loadError}
      currentUserId={user?.id ?? null}
      envCheck={envCheck}
    />
  );
}
