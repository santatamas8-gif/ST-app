import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAppUser, isAdmin, isImmutableAdminEmail } from "@/lib/auth";
import { getPlayerCheckInStatus } from "@/lib/checkInStatus";
import { getUnreadTotal } from "@/app/actions/chat";
import { Sidebar } from "@/components/Sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await getAppUser();
  } catch {
    redirect("/login");
  }
  if (!user) redirect("/login");

  let todoToday: { wellnessDone: boolean; rpeDone: boolean } | null = null;
  let unreadChatCount = 0;
  try {
    if (user.role === "player") {
      todoToday = await getPlayerCheckInStatus(user.id);
    }
  } catch {
    // Player check-in status optional for layout; sidebar shows no dots
  }
  try {
    unreadChatCount = await getUnreadTotal();
  } catch {
    // Unread count optional; sidebar shows 0
  }
  const canAccessUsers = isAdmin(user.role) || (user.role === "staff" && isImmutableAdminEmail(user.email));

  return (
    <ThemeProvider>
      <div className="flex min-h-screen flex-col" style={{ backgroundColor: "var(--page-bg)" }}>
        <Sidebar role={user.role} userEmail={user.email} todoToday={todoToday} unreadChatCount={unreadChatCount} canAccessUsers={canAccessUsers}>
          <Suspense fallback={<div className="p-4 sm:p-6 lg:p-8" />}>
            <div className="p-4 sm:p-6 lg:p-8">{children}</div>
          </Suspense>
        </Sidebar>
      </div>
    </ThemeProvider>
  );
}
