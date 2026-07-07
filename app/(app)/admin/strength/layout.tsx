import { redirect } from "next/navigation";
import { getAppUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Strength Card Builder: admin only (not staff). */
export default async function StrengthAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAppUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/forbidden");
  return <>{children}</>;
}
