"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, User, Lock, UserCircle, Calendar, Settings } from "lucide-react";
import type { ProfileRow } from "./page";
import { createUser, updateUserRole, updateUserFullName } from "@/app/actions/admin-users";
import type { UserRole } from "@/lib/types";

const CARD_RADIUS = "12px";

/** Renders date only after mount to avoid server/client locale mismatch (hydration error). */
function FormattedDate({ dateStr }: { dateStr: string | null }) {
  const [formatted, setFormatted] = useState<string | null>(null);
  useEffect(() => {
    if (!dateStr) return;
    setFormatted(new Date(dateStr).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }));
  }, [dateStr]);
  if (!dateStr) return <>—</>;
  return <>{formatted ?? "…"}</>;
}

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
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
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

  async function handleNameChange(userId: string, fullName: string) {
    const result = await updateUserFullName(userId, fullName);
    if (!result.error) {
      setEditingNameId(null);
      router.refresh();
    }
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
      className="min-h-screen min-w-0 -mx-4 overflow-x-hidden px-3 py-8 sm:mx-0 sm:px-6 lg:px-8"
      style={{ backgroundColor: "var(--page-bg)" }}
    >
      <div className="mx-auto max-w-6xl min-w-0 space-y-6">
        <div className="border-b border-zinc-800/60 pb-5">
          <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl lg:text-2xl">
            Users
          </h1>
          <p className="mt-1 text-sm text-zinc-400 sm:text-base">
            Create staff and player accounts. Edit names and roles. All UI in English.
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
            className="rounded-xl border border-[#1eb871]/20 bg-[#1eb871]/10 p-4"
            style={{ borderRadius: CARD_RADIUS }}
          >
            <p className="font-medium text-[#1eb871]">User created successfully.</p>
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

        {/* Toolbar: stacked on mobile, row on md+; touch-friendly */}
        <div
          className="flex flex-col gap-3 rounded-2xl border border-zinc-800/70 bg-zinc-950/50 p-4 shadow-lg shadow-black/20 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
          style={{ borderRadius: CARD_RADIUS }}
        >
          <input
            type="search"
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-zinc-700 bg-zinc-800/90 px-3 py-2.5 text-base text-white placeholder-zinc-500 focus:border-[#1eb871] focus:outline-none focus:ring-1 focus:ring-[#1eb871]/50 sm:min-h-0 sm:w-56 sm:py-2 sm:text-sm"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            className="min-h-[44px] w-full rounded-lg border border-zinc-700 bg-zinc-800/90 px-3 py-2.5 text-base text-white focus:border-[#1eb871] focus:outline-none focus:ring-1 focus:ring-[#1eb871]/50 sm:min-h-0 sm:w-auto sm:py-2 sm:text-sm"
          >
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="player">Player</option>
          </select>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="min-h-[44px] w-full rounded-lg bg-[#1eb871] px-4 py-2.5 text-base font-medium text-white shadow-lg shadow-emerald-900/30 transition hover:brightness-110 sm:min-h-0 sm:w-auto sm:py-2 sm:text-sm"
          >
            Create user
          </button>
        </div>

        {/* Mobile: card list */}
        <div
          className="space-y-2 overflow-hidden md:hidden"
          style={{ borderRadius: CARD_RADIUS }}
        >
          {filtered.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center rounded-xl py-12 text-center"
              style={{ backgroundColor: "var(--card-bg)" }}
            >
              <p className="text-sm text-zinc-400">
                {list.length === 0 ? "No users yet." : "No users match the filters."}
              </p>
            </div>
          ) : (
            filtered.map((u) => (
              <div
                key={u.id}
                className="rounded-xl border border-zinc-700/80 p-3 shadow-md shadow-black/10"
                style={{ backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-700/80 text-zinc-300"
                    aria-hidden
                  >
                    <User className="h-3.5 w-3.5" />
                  </span>
                  <p className="font-medium text-sm text-white">{u.full_name || "—"}</p>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-700/80 text-zinc-300"
                    aria-hidden
                  >
                    <Mail className="h-3.5 w-3.5" />
                  </span>
                  <p className="min-w-0 truncate text-xs text-zinc-400">{u.email}</p>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-700/80 text-zinc-300"
                    aria-hidden
                  >
                    <UserCircle className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-xs capitalize text-zinc-300">{u.role}</p>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-700/80 text-zinc-300"
                    aria-hidden
                  >
                    <Calendar className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-xs text-zinc-500">
                    <FormattedDate dateStr={u.created_at} />
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {editingNameId === u.id ? (
                    <NameEditRow
                      currentName={u.full_name ?? ""}
                      onSave={(name) => handleNameChange(u.id, name)}
                      onCancel={() => setEditingNameId(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingNameId(u.id)}
                      className="min-h-[36px] rounded-lg border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-xs text-[#1eb871] hover:bg-zinc-700"
                    >
                      Edit name
                    </button>
                  )}
                  {editingId === u.id ? (
                    <RoleEditRow
                      currentRole={u.role as UserRole}
                      onSave={(newRole) => handleRoleChange(u.id, newRole)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : !(u.isPrimaryAdmin && u.role === "admin") ? (
                    <button
                      type="button"
                      onClick={() => setEditingId(u.id)}
                      className="min-h-[36px] rounded-lg border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-xs text-[#1eb871] hover:bg-zinc-700"
                    >
                      Edit role
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(u)}
                    disabled={currentUserId === u.id || !!u.isPrimaryAdmin}
                    className="min-h-[36px] rounded-lg border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-xs text-red-400 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                    title={
                      u.isPrimaryAdmin
                        ? "Primary admin cannot be removed"
                        : currentUserId === u.id
                          ? "You cannot delete your own account"
                          : "Delete user"
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Table: desktop only */}
        <div
          className="hidden overflow-hidden rounded-2xl border border-zinc-800/70 shadow-lg shadow-black/20 md:block"
          style={{ backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }}
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
                <thead className="sticky top-0 z-10 border-b-2 border-zinc-700 bg-zinc-800/95">
                  <tr>
                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-white">
                      <span className="inline-flex items-center gap-2">
                        <User className="h-4 w-4 shrink-0 text-white" aria-hidden />
                        Full name
                      </span>
                    </th>
                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-white">
                      <span className="inline-flex items-center gap-2">
                        <Mail className="h-4 w-4 shrink-0 text-white" aria-hidden />
                        Email
                      </span>
                    </th>
                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-white">
                      <span className="inline-flex items-center gap-2">
                        <UserCircle className="h-4 w-4 shrink-0 text-white" aria-hidden />
                        Role
                      </span>
                    </th>
                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-white">
                      <span className="inline-flex items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0 text-white" aria-hidden />
                        Created at
                      </span>
                    </th>
                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-white">
                      <span className="inline-flex items-center gap-2">
                        <Settings className="h-4 w-4 shrink-0 text-white" aria-hidden />
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70 text-zinc-200">
                  {filtered.map((u) => (
                    <tr key={u.id} className="transition-colors hover:bg-zinc-800/50">
                      <td className="px-4 py-3 align-middle">
                        {editingNameId === u.id ? (
                          <NameEditRow
                            currentName={u.full_name ?? ""}
                            onSave={(name) => handleNameChange(u.id, name)}
                            onCancel={() => setEditingNameId(null)}
                          />
                        ) : (
                          <span className="flex flex-wrap items-center gap-2">
                            <span
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-700/80 text-zinc-300"
                              aria-hidden
                            >
                              <User className="h-4 w-4" />
                            </span>
                            <span className="flex flex-wrap items-center gap-2">
                              <span>{u.full_name || "—"}</span>
                              <button
                                type="button"
                                onClick={() => setEditingNameId(u.id)}
                                className="text-[#1eb871] hover:underline"
                              >
                                Edit name
                              </button>
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-zinc-400">
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-700/80 text-zinc-300"
                            aria-hidden
                          >
                            <Mail className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 truncate">{u.email}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle capitalize text-zinc-300">{u.role}</td>
                      <td className="px-4 py-3 align-middle text-zinc-500">
                        <FormattedDate dateStr={u.created_at} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-wrap items-center gap-2">
                          {editingId === u.id ? (
                            <RoleEditRow
                              currentRole={u.role as UserRole}
                              onSave={(newRole) => handleRoleChange(u.id, newRole)}
                              onCancel={() => setEditingId(null)}
                            />
                          ) : u.isPrimaryAdmin && u.role === "admin" ? (
                            <span className="text-xs text-zinc-500" title="Primary admin cannot be demoted">—</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingId(u.id)}
                              className="text-[#1eb871] hover:underline"
                            >
                              Edit role
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(u)}
                            disabled={currentUserId === u.id || !!u.isPrimaryAdmin}
                            className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-red-400 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                            title={
                              u.isPrimaryAdmin
                                ? "Primary admin cannot be removed"
                                : currentUserId === u.id
                                  ? "You cannot delete your own account"
                                  : "Delete user"
                            }
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

function NameEditRow({
  currentName,
  onSave,
  onCancel,
}: {
  currentName: string;
  onSave: (name: string) => Promise<{ error?: string }>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setLoading(true);
    const result = await onSave(name);
    setLoading(false);
    if (result.error) setError(result.error);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name"
        className="min-w-[120px] rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
        autoFocus
      />
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
  const [showPassword, setShowPassword] = useState(false);

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
        className="w-full max-w-md rounded-2xl border border-zinc-700/80 p-6 shadow-2xl sm:p-7"
        style={{
          backgroundColor: "rgba(18,28,22,0.97)",
          borderRadius: CARD_RADIUS,
          boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(30,184,113,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-between border-b border-zinc-800/70 pb-4">
          <div className="flex-1" />
          <div className="absolute left-1/2 top-0 flex -translate-x-1/2 flex-col items-center pt-0">
            <p className="text-sm font-semibold tracking-tight text-zinc-100">
              ST<span className="mx-0.5 inline-block h-0.5 w-2.5 align-middle rounded-full bg-zinc-600/60" aria-hidden />
              <span className="text-[#1eb871]">AMS</span>
            </p>
            <h2 id="create-user-title" className="mt-1 text-base font-medium text-zinc-200">
              Create user
            </h2>
          </div>
          <div className="flex-1 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="create-full_name" className="flex items-center gap-2 text-sm font-medium text-zinc-200">
              <User className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
              <span>Full name (required)</span>
            </label>
            <input
              id="create-full_name"
              name="full_name"
              type="text"
              required
              autoComplete="name"
              placeholder="John Doe"
              className="mt-2 w-full rounded-lg border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-[#1eb871] focus:outline-none focus:ring-1 focus:ring-[#1eb871]"
            />
          </div>
          <div>
            <label htmlFor="create-email" className="flex items-center gap-2 text-sm font-medium text-zinc-200">
              <Mail className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
              <span>Email (required)</span>
            </label>
            <input
              id="create-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="user@example.com"
              className="mt-2 w-full rounded-lg border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-[#1eb871] focus:outline-none focus:ring-1 focus:ring-[#1eb871]"
            />
          </div>
          <div>
            <label htmlFor="create-password" className="flex items-center gap-2 text-sm font-medium text-zinc-200">
              <Lock className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
              <span>Password (required, min 8 characters)</span>
            </label>
            <div className="relative mt-2">
              <input
                id="create-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-zinc-600 bg-zinc-900/80 py-2 pl-3 pr-10 text-sm text-white placeholder-zinc-500 focus:border-[#1eb871] focus:outline-none focus:ring-1 focus:ring-[#1eb871]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="create-role" className="flex items-center gap-2 text-sm font-medium text-zinc-200">
              <UserCircle className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
              <span>Role (required)</span>
            </label>
            <select
              id="create-role"
              name="role"
              required
              className="mt-2 w-full rounded-lg border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-sm text-white focus:border-[#1eb871] focus:outline-none focus:ring-1 focus:ring-[#1eb871]"
            >
              <option value="player">Player</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex items-center gap-2.5">
            <input
              id="create-confirm-admin"
              type="checkbox"
              checked={confirmAdmin}
              onChange={(e) => setConfirmAdmin(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-[#1eb871] focus:ring-[#1eb871]"
            />
            <label htmlFor="create-confirm-admin" className="text-sm text-zinc-400">
              I confirm creating an admin account (only when role is Admin)
            </label>
          </div>
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: "#1eb871", boxShadow: "0 10px 30px -10px rgba(30,184,113,0.45)" }}
            >
              {loading ? "Creating…" : "Create user"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
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
        style={{ backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }}
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
