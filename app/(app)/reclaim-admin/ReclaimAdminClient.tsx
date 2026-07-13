"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getReclaimAdminStatus, reclaimAdminRole } from "@/app/actions/admin-users";

export function ReclaimAdminClient() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "allowed" | "forbidden" | "login" | "dashboard">("loading");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReclaimAdminStatus().then((r) => {
      if (r.notLoggedIn) {
        router.replace("/login");
        return;
      }
      if (r.alreadyAdmin) {
        router.replace("/dashboard");
        return;
      }
      if (r.canReclaim) {
        setStatus("allowed");
        return;
      }
      setStatus("forbidden");
    });
  }, [router]);

  async function handleRestore() {
    setError(null);
    setLoading(true);
    const result = await reclaimAdminRole();
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    window.location.href = "/dashboard";
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <p className="text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (status === "forbidden") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div
          className="w-full max-w-md rounded-xl border border-amber-900/50 bg-amber-950/20 p-6"
          style={{ borderRadius: 12 }}
        >
          <h1 className="text-xl font-semibold text-amber-400">Access denied</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Only the primary admin (IMMUTABLE_ADMIN_EMAIL) can restore admin role here.
          </p>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (status !== "allowed") return null;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div
        className="w-full max-w-md rounded-xl border border-amber-800/50 bg-amber-950/20 p-6"
        style={{ borderRadius: 12 }}
      >
        <h1 className="text-xl font-semibold text-amber-400">Restore admin role</h1>
        <p className="mt-2 text-sm text-zinc-400">
          You are the primary admin. Click below to restore your admin role.
        </p>
        <button
          type="button"
          onClick={handleRestore}
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Restoring…" : "Restore my admin role"}
        </button>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
