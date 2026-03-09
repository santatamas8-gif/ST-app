import Link from "next/link";

/**
 * No public signup: only admin creates user accounts (Admin → Users).
 * Players and staff receive their login details from the administrator.
 */
export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center shadow-xl">
        <h1 className="text-xl font-bold tracking-tight text-white">
          No public registration
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          Accounts are created by your administrator. Contact them to get your
          login email and password.
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          If you already have an account, sign in below.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-500"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
