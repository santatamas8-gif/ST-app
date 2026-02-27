import { redirect } from "next/navigation";
import { getAppUser, isAdmin, isImmutableAdminEmail } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAppUser();
  if (!user) redirect("/login");
  const canAccessAdmin = isAdmin(user.role) || (user.role === "staff" && isImmutableAdminEmail(user.email));
  if (!canAccessAdmin) redirect("/forbidden");
  return <>{children}</>;
}
