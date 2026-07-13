import { getAppUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getChatRooms, getUnreadByRoom, getLastMessageByRoom } from "@/app/actions/chat";
import { getTeamSettings } from "@/app/actions/teamSettings";
import { ChatLayout } from "@/components/chat/ChatLayout";

export default async function ChatLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAppUser();
  if (!user) redirect("/login");

  const [rooms, unreadByRoom, lastMessageByRoom, teamSettings] = await Promise.all([
    getChatRooms(),
    getUnreadByRoom(),
    getLastMessageByRoom(),
    getTeamSettings(),
  ]);
  const isAdmin = user.role === "admin";

  return (
    <div className="flex min-h-0 w-full flex-col h-[calc(100vh-4rem)] sm:h-[calc(100vh-6rem)] lg:h-[calc(100vh-5rem)] px-0 lg:px-3">
      <ChatLayout
        rooms={rooms}
        unreadByRoom={unreadByRoom}
        lastMessageByRoom={lastMessageByRoom}
        isAdmin={isAdmin}
        teamLogoUrl={teamSettings?.team_logo_url ?? null}
      >
        {children}
      </ChatLayout>
    </div>
  );
}
