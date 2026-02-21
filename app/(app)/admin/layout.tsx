import { redirect } from "next/navigation";
import { getAppUser, isAdmin } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAppUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/dashboard");
  return <>{children}</>;
}
