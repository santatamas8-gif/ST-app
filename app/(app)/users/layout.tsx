import { redirect } from "next/navigation";
import { getAppUser, canAccessUsers } from "@/lib/auth";

export default async function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAppUser();
  if (!user) redirect("/login");
  if (!canAccessUsers(user.role)) redirect("/dashboard");
  return <>{children}</>;
}
