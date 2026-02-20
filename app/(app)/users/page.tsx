import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { AddPlayerForm } from "@/components/AddPlayerForm";

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Users
        </h1>
        <p className="mt-1 text-zinc-400">
          Manage app users (admin only)
        </p>
      </div>

      <Card title="Játékos hozzáadása">
        <p className="mb-4 text-sm text-zinc-400">
          Add meg az email címet és egy ideiglenes jelszót. A játékos ezzel tud bejelentkezni (pl. telefonról).
        </p>
        <AddPlayerForm />
      </Card>

      <Card title="All users">
        {error ? (
          <p className="text-red-400">
            Failed to load users. Ensure the Supabase &quot;profiles&quot; table
            exists and RLS allows read for your role.
          </p>
        ) : !users?.length ? (
          <p className="text-zinc-400">No users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-400">
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Role</th>
                  <th className="pb-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-800">
                    <td className="py-3 pr-4">{u.email}</td>
                    <td className="py-3 pr-4 capitalize">{u.role}</td>
                    <td className="py-3">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
