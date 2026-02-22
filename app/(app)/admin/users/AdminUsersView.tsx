"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProfileRow } from "./page";
import { createUser, updateUserRole } from "@/app/actions/admin-users";
import type { UserRole } from "@/lib/types";

const BG_PAGE = "#0b0f14";
const BG_CARD = "#11161c";
const CARD_RADIUS = "12px";

type RoleFilter = "all" | "admin" | "staff" | "player";

interface AdminUsersViewProps {
  list: ProfileRow[];
  loadError: { code: string; message: string } | null;
  currentUserId?: string | null;
  envCheck?: {
    supabaseHost: string;
    buildEnv: string;
    currentUserId: string | null;
    currentUserRole: string | null;
  } | null;
}

export function AdminUsersView({ list, loadError, currentUserId = null, envCheck = null }: AdminUsersViewProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [successResult, setSuccessResult] = useState<{ email: string; role: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProfileRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const filtered = useMemo(() => {
    let rows = list;
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (u) =>
          (u.email ?? "").toLowerCase().includes(q) ||
          (u.full_name ?? "").toLowerCase().includes(q)
      );
    }
    if (roleFilter !== "all") {
      rows = rows.filter((u) => u.role === roleFilter);
    }
    rows = [...rows].sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });
    return rows;
  }, [list, search, roleFilter]);

  async function handleCreate(formData: FormData) {
    const full_name = (formData.get("full_name") as string)?.trim() ?? "";
    const email = (formData.get("email") as string)?.trim() ?? "";
    const password = (formData.get("password") as string) ?? "";
    const role = (formData.get("role") as UserRole) ?? "player";

    const result = await createUser({ full_name, email, password, role });
    if (result.error) {
      return { error: result.error };
    }
    setCreateOpen(false);
    setSuccessResult(result.success ? { email: result.email ?? email, role: result.role ?? role } : null);
    return result;
  }

  async function handleRoleChange(userId: string, newRole: UserRole) {
    const result = await updateUserRole(userId, newRole);
    if (result.success) setEditingId(null);
    return result;
  }

  async function handleDelete(userId: string) {
    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data.error as string) || "Delete failed." };
    }
    setDeleteTarget(null);
    setDeleteConfirmText("");
    router.refresh();
    return {};
  }

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ backgroundColor: BG_PAGE }}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Users
          </h1>
          <p className="mt-1 text-zinc-400">
            Create staff and player accounts. Edit roles. All UI in English.
          </p>
        </div>

        {loadError && (
          <div
            className="rounded-xl border border-red-900/50 bg-red-950/20 p-4"
            style={{ borderRadius: CARD_RADIUS }}
          >
            <p className="font-medium text-red-400">Profiles query failed</p>
            <p className="mt-1 text-sm text-zinc-300">
              <span className="text-zinc-500">code:</span> {loadError.code}
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              <span className="text-zinc-500">message:</span> {loadError.message}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              Ensure the profiles table has id, email, role, created_at, full_name and RLS allows admin read.
            </p>
          </div>
        )}

        {envCheck && (
          <div
            className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4 font-mono text-sm"
            style={{ borderRadius: CARD_RADIUS }}
          >
            <p className="mb-2 font-semibold text-zinc-300">Environment check (admin only)</p>
            <p className="text-zinc-400">
              <span className="text-zinc-500">Supabase host:</span> {envCheck.supabaseHost}
            </p>
            <p className="mt-1 text-zinc-400">
              <span className="text-zinc-500">Build env:</span> {envCheck.buildEnv}
            </p>
            <p className="mt-1 text-zinc-400">
              <span className="text-zinc-500">Current user id:</span> {envCheck.currentUserId ?? "(none)"}
            </p>
            <p className="mt-1 text-zinc-400">
              <span className="text-zinc-500">Detected role:</span> {envCheck.currentUserRole ?? "(none)"}
            </p>
          </div>
        )}

        {/* Success panel */}
        {successResult && (
          <div
            className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4"
            style={{ borderRadius: CARD_RADIUS }}
          >
            <p className="font-medium text-emerald-400">User created successfully.</p>
            <p className="mt-1 text-sm text-zinc-300">
              Email: {successResult.email} · Role: {successResult.role}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              They can sign in with the email and password you set. The password is not shown again.
            </p>
            <button
              type="button"
              onClick={() => setSuccessResult(null)}
              className="mt-2 text-sm text-zinc-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div
          className="flex flex-wrap items-center gap-4 rounded-xl p-4"
          style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
        >
          <input
            type="search"
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:w-56"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="player">Player</option>
          </select>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Create user
          </button>
        </div>

        {/* Table */}
        <div
          className="overflow-hidden rounded-xl"
          style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
        >
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-zinc-400">
                {list.length === 0 ? "No users yet." : "No users match the filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-900/95">
                  <tr className="border-b border-zinc-700 text-zinc-400">
                    <th className="px-4 py-3 font-medium">Full name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Created at</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  {filtered.map((u) => (
                    <tr key={u.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                      <td className="px-4 py-3">{u.full_name || "—"}</td>
                      <td className="px-4 py-3">{u.email}</td>
                      <td className="px-4 py-3 capitalize">{u.role}</td>
                      <td className="px-4 py-3">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {editingId === u.id ? (
                            <RoleEditRow
                              currentRole={u.role as UserRole}
                              onSave={(newRole) => handleRoleChange(u.id, newRole)}
                              onCancel={() => setEditingId(null)}
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingId(u.id)}
                              className="text-emerald-400 hover:underline"
                            >
                              Edit role
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(u)}
                            disabled={currentUserId === u.id}
                            className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-red-400 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                            title={currentUserId === u.id ? "You cannot delete your own account" : "Delete user"}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {createOpen && (
        <CreateUserModal
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          user={deleteTarget}
          confirmText={deleteConfirmText}
          onConfirmTextChange={setDeleteConfirmText}
          onClose={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}
          onConfirm={() => handleDelete(deleteTarget.id)}
        />
      )}
    </div>
  );
}

function RoleEditRow({
  currentRole,
  onSave,
  onCancel,
}: {
  currentRole: UserRole;
  onSave: (role: UserRole) => Promise<{ error?: string }>;
  onCancel: () => void;
}) {
  const [role, setRole] = useState<UserRole>(currentRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (role === currentRole) {
      onCancel();
      return;
    }
    setError(null);
    setLoading(true);
    const result = await onSave(role);
    setLoading(false);
    if (result.error) setError(result.error);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as UserRole)}
        className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-white text-sm"
      >
        <option value="admin">Admin</option>
        <option value="staff">Staff</option>
        <option value="player">Player</option>
      </select>
      <button
        type="button"
        onClick={handleSave}
        disabled={loading}
        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

function CreateUserModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (formData: FormData) => Promise<{ error?: string }>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAdmin, setConfirmAdmin] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const role = (formData.get("role") as UserRole) ?? "player";
    if (role === "admin" && !confirmAdmin) {
      setError("To create an admin, check the confirmation box.");
      return;
    }
    setLoading(true);
    const result = await onSubmit(formData);
    setLoading(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-user-title"
    >
      <div
        className="w-full max-w-md rounded-xl p-6 shadow-xl"
        style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <h2 id="create-user-title" className="text-xl font-bold text-white">
            Create user
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="create-full_name" className="block text-sm font-medium text-zinc-300">
              Full name (required)
            </label>
            <input
              id="create-full_name"
              name="full_name"
              type="text"
              required
              autoComplete="name"
              placeholder="John Doe"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="create-email" className="block text-sm font-medium text-zinc-300">
              Email (required)
            </label>
            <input
              id="create-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="user@example.com"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="create-password" className="block text-sm font-medium text-zinc-300">
              Password (required, min 8 characters)
            </label>
            <input
              id="create-password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="create-role" className="block text-sm font-medium text-zinc-300">
              Role (required)
            </label>
            <select
              id="create-role"
              name="role"
              required
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="player">Player</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="create-confirm-admin"
              type="checkbox"
              checked={confirmAdmin}
              onChange={(e) => setConfirmAdmin(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500"
            />
            <label htmlFor="create-confirm-admin" className="text-sm text-zinc-400">
              I confirm creating an admin account (only when role is Admin)
            </label>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create user"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-zinc-700 px-4 py-2 font-medium text-zinc-300 hover:bg-zinc-600"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  user,
  confirmText,
  onConfirmTextChange,
  onClose,
  onConfirm,
}: {
  user: ProfileRow;
  confirmText: string;
  onConfirmTextChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => Promise<{ error?: string }>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDelete = confirmText === "DELETE";

  async function handleConfirm() {
    if (!canDelete) return;
    setError(null);
    setLoading(true);
    const result = await onConfirm();
    setLoading(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-xl p-6 shadow-xl"
        style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-red-400">Delete user</h2>
        <p className="mt-2 text-sm text-zinc-400">
          User: <span className="font-medium text-white">{user.email}</span>
        </p>
        <p className="mt-2 text-sm text-amber-400">
          This will permanently remove the user and their data. They will not be able to log in.
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Type <strong className="text-white">DELETE</strong> to confirm.
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => onConfirmTextChange(e.target.value)}
          placeholder="DELETE"
          className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canDelete || loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
