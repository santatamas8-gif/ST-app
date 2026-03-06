import { getAppUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getChatRooms, getUnreadByRoom, getLastMessageByRoom } from "@/app/actions/chat";
import { ChatLayout } from "@/components/chat/ChatLayout";

export default async function ChatLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAppUser();
  if (!user) redirect("/login");

  const [rooms, unreadByRoom, lastMessageByRoom] = await Promise.all([
    getChatRooms(),
    getUnreadByRoom(),
    getLastMessageByRoom(),
  ]);
  const isAdmin = user.role === "admin";

  return (
    <div className="flex h-[calc(100vh-6rem)] min-h-0 w-full flex-col px-3 sm:px-0 lg:h-[calc(100vh-5rem)]">
      <ChatLayout
        rooms={rooms}
        unreadByRoom={unreadByRoom}
        lastMessageByRoom={lastMessageByRoom}
        isAdmin={isAdmin}
      >
        {children}
      </ChatLayout>
    </div>
  );
}
