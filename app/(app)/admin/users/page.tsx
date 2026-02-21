import { createClient } from "@/lib/supabase/server";
import { AdminUsersView } from "./AdminUsersView";

export type ProfileRow = {
  id: string;
  email: string;
  role: string;
  created_at: string | null;
  full_name?: string | null;
};

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, role, created_at, full_name")
    .order("created_at", { ascending: false });

  const list: ProfileRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email ?? "",
    role: p.role ?? "player",
    created_at: p.created_at ?? null,
    full_name: p.full_name ?? null,
  }));

  return (
    <AdminUsersView
      list={list}
      loadError={error?.message ?? null}
    />
  );
}
