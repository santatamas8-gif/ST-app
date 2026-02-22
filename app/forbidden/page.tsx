import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4"
      style={{ backgroundColor: "#0b0f14" }}
    >
      <div className="mx-auto max-w-md rounded-xl border border-amber-900/50 bg-amber-950/20 p-6" style={{ borderRadius: 12 }}>
        <h1 className="text-xl font-semibold text-amber-400">Access denied</h1>
        <p className="mt-2 text-sm text-zinc-400">
          You don&apos;t have permission to view this page.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
