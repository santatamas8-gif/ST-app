import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth";
import { getPlayerCheckInStatus } from "@/lib/checkInStatus";
import { Sidebar } from "@/components/Sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAppUser();
  if (!user) redirect("/login");

  const todoToday =
    user.role === "player"
      ? await getPlayerCheckInStatus(user.id)
      : null;

  return (
    <ThemeProvider>
      <div className="flex min-h-screen flex-col md:flex-row" style={{ backgroundColor: "var(--page-bg)" }}>
        <Sidebar role={user.role} userEmail={user.email} todoToday={todoToday} />
        <main className="min-w-0 flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </ThemeProvider>
  );
}
