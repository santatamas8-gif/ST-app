import { redirect } from "next/navigation";
import { getAppUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Movement Prep: admin only. Staff and players are refused, including direct URLs. */
export default async function MovementPrepLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAppUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/forbidden");
  return <>{children}</>;
}
